import { createHash, randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateUID, safeCompare } from '../utils/helpers';
import { AgentStore } from '../stores/AgentStore';
import {
	AgentCapabilities,
	AgentJobPayload,
	AgentJobRecord,
	AgentPairingRequest,
	AgentPlatform,
	AgentRecord,
	EnrollmentTokenRecord,
} from '../types/agents';
import { AppError, NotFoundError } from '../utils/AppError';

export class AgentService {
	constructor(private readonly agentStore: AgentStore) {}

	private hash(value: string): string {
		return createHash('sha256').update(value).digest('hex');
	}

	private validatePlatform(platform: string): AgentPlatform {
		if (platform === 'linux' || platform === 'windows' || platform === 'darwin') {
			return platform;
		}
		return 'unknown';
	}

	private ensureBackupPolicy(payload: AgentJobPayload, targetAgent: AgentRecord): void {
		const isDbPayload = payload.sourceType === 'database' || payload.mode === 'database_backup';
		if (!isDbPayload) {
			return;
		}
		if (targetAgent.id !== 'main') {
			throw new AppError(403, 'Database backups are allowed only on the main server agent.');
		}
	}

	private buildAgentRecordFromPairing(
		request: AgentPairingRequest,
		agentId: string,
		agentSecret: string
	): AgentRecord {
		const now = Date.now();
		return {
			id: agentId,
			name: request.agentName || request.hostname || agentId,
			hostname: request.hostname || '',
			platform: request.platform,
			arch: request.arch || '',
			osVersion: request.osVersion || '',
			capabilities: request.capabilities,
			agentVersion: request.agentVersion || '',
			secretHash: this.hash(agentSecret),
			registeredAt: now,
			lastSeenAt: now,
			status: 'online',
		};
	}

	private getInstallerCandidates(platformId: 'windows' | 'linux'): { filePath: string; filename: string }[] {
		const serviceDir = path.dirname(fileURLToPath(import.meta.url));
		const rootCandidates = [
			process.cwd(),
			path.resolve(process.cwd(), '..'),
			path.resolve(serviceDir, '../../..'),
			path.resolve(serviceDir, '../..'),
		];

		const uniqueRoots = [...new Set(rootCandidates)];
		const candidates: { filePath: string; filename: string }[] = [];

		for (const root of uniqueRoots) {
			if (platformId === 'windows') {
				candidates.push({
					filePath: path.join(root, 'installers', 'windows', 'pluton-agent.exe'),
					filename: 'pluton-agent.exe',
				});
				candidates.push({
					filePath: path.join(root, 'installers', 'windows', 'PlutonAgentSetup.exe'),
					filename: 'PlutonAgentSetup.exe',
				});
			} else {
				candidates.push({
					filePath: path.join(root, 'installers', 'linux', 'pluton-agent.deb'),
					filename: 'pluton-agent.deb',
				});
				candidates.push({
					filePath: path.join(root, 'installers', 'linux', 'pluton-agent_amd64.deb'),
					filename: 'pluton-agent_amd64.deb',
				});
			}
		}

		return candidates;
	}

	async resolveInstallerDownload(platformId: 'windows' | 'linux'): Promise<{ filePath: string; filename: string }> {
		const candidates = this.getInstallerCandidates(platformId);
		for (const item of candidates) {
			try {
				await fs.access(item.filePath);
				return item;
			} catch {
				continue;
			}
		}

		throw new NotFoundError(
			`Installer not found for ${platformId}. Add the installer file under installers/${platformId}/.`
		);
	}

	async createEnrollmentToken(input: {
		name: string;
		expiresInMinutes?: number;
		maxUses?: number;
		allowedPlatforms?: string[];
	}): Promise<{ tokenId: string; token: string; expiresAt: number }> {
		const expiresInMinutes = input.expiresInMinutes && input.expiresInMinutes > 0 ? input.expiresInMinutes : 60;
		const maxUses = input.maxUses && input.maxUses > 0 ? input.maxUses : 1;
		const allowedPlatforms = (input.allowedPlatforms || ['linux', 'windows', 'darwin'])
			.map(p => this.validatePlatform(p))
			.filter(p => p !== 'unknown');

		const tokenId = 'etk_' + generateUID(10);
		const rawToken = 'pluton_enroll_' + randomBytes(24).toString('hex');
		const record: EnrollmentTokenRecord = {
			id: tokenId,
			name: input.name || tokenId,
			tokenHash: this.hash(rawToken),
			expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
			maxUses,
			uses: 0,
			allowedPlatforms: allowedPlatforms.length > 0 ? allowedPlatforms : ['linux', 'windows', 'darwin'],
			revoked: false,
			createdAt: Date.now(),
		};
		await this.agentStore.createEnrollmentToken(record);
		return { tokenId, token: rawToken, expiresAt: record.expiresAt };
	}

	async enrollAgent(input: {
		token: string;
		agentName: string;
		hostname: string;
		platform: string;
		arch: string;
		osVersion: string;
		capabilities?: Partial<AgentCapabilities>;
		agentVersion: string;
		wsUrl?: string;
	}): Promise<{
		agentId: string;
		agentSecret: string;
		heartbeatIntervalSec: number;
		pollIntervalSec: number;
	}> {
		const tokenHash = this.hash(input.token || '');
		const tokenRecord = await this.agentStore.findEnrollmentTokenByHash(tokenHash);
		if (!tokenRecord) {
			throw new AppError(401, 'Invalid enrollment token.');
		}
		if (tokenRecord.revoked) {
			throw new AppError(401, 'Enrollment token has been revoked.');
		}
		if (Date.now() > tokenRecord.expiresAt) {
			throw new AppError(401, 'Enrollment token has expired.');
		}
		if (tokenRecord.uses >= tokenRecord.maxUses) {
			throw new AppError(401, 'Enrollment token has reached max uses.');
		}

		const platform = this.validatePlatform(input.platform);
		if (!tokenRecord.allowedPlatforms.includes(platform)) {
			throw new AppError(403, 'This enrollment token does not allow this platform.');
		}

		const agentId = 'agt_' + generateUID(10);
		const agentSecret = 'agts_' + randomBytes(24).toString('hex');
		const now = Date.now();

		const agent: AgentRecord = {
			id: agentId,
			name: input.agentName || input.hostname || agentId,
			hostname: input.hostname || '',
			platform,
			arch: input.arch || '',
			osVersion: input.osVersion || '',
			capabilities: {
				fileBackup: input.capabilities?.fileBackup ?? true,
				fullBackup: input.capabilities?.fullBackup ?? true,
				dbBackup: input.capabilities?.dbBackup ?? false,
			},
			agentVersion: input.agentVersion || '',
			secretHash: this.hash(agentSecret),
			registeredAt: now,
			lastSeenAt: now,
			status: 'online',
		};

		await this.agentStore.createAgent(agent);
		await this.agentStore.updateEnrollmentToken(tokenRecord.id, { uses: tokenRecord.uses + 1 });

		return {
			agentId,
			agentSecret,
			heartbeatIntervalSec: 30,
			pollIntervalSec: 15,
		};
	}

	async authenticateAgent(agentId: string, agentSecret: string): Promise<AgentRecord> {
		if (!agentId || !agentSecret) {
			throw new AppError(401, 'Missing agent credentials.');
		}
		const agent = await this.agentStore.getAgentById(agentId);
		if (!agent) {
			throw new AppError(401, 'Unknown agent.');
		}
		const hashed = this.hash(agentSecret);
		if (!safeCompare(agent.secretHash, hashed)) {
			throw new AppError(401, 'Invalid agent credentials.');
		}
		return agent;
	}

	async heartbeat(agentId: string): Promise<void> {
		await this.agentStore.updateAgent(agentId, { lastSeenAt: Date.now(), status: 'online' });
	}

	async listAgents(): Promise<AgentRecord[]> {
		return this.agentStore.getAgents();
	}

	async createPairingRequest(input: {
		agentName: string;
		hostname: string;
		platform: string;
		arch: string;
		osVersion: string;
		agentVersion: string;
		capabilities?: Partial<AgentCapabilities>;
	}): Promise<{ pairingCode: string; expiresAt: number; pollIntervalSec: number }> {
		const platform = this.validatePlatform(input.platform);
		const pairingCode = 'PAIR-' + randomBytes(3).toString('hex').toUpperCase();
		const now = Date.now();
		const request: AgentPairingRequest = {
			id: 'pair_' + generateUID(10),
			pairingCode,
			agentName: input.agentName || input.hostname,
			hostname: input.hostname || '',
			platform,
			arch: input.arch || '',
			osVersion: input.osVersion || '',
			agentVersion: input.agentVersion || '',
			capabilities: {
				fileBackup: input.capabilities?.fileBackup ?? true,
				fullBackup: input.capabilities?.fullBackup ?? true,
				dbBackup: input.capabilities?.dbBackup ?? false,
			},
			status: 'pending',
			createdAt: now,
			expiresAt: now + 10 * 60 * 1000,
		};

		await this.agentStore.createPairingRequest(request);
		return { pairingCode, expiresAt: request.expiresAt, pollIntervalSec: 10 };
	}

	async approvePairingCode(pairingCode: string): Promise<{ agentId: string; name: string; platform: AgentPlatform }> {
		const request = await this.agentStore.getPairingRequestByCode(pairingCode);
		if (!request) {
			throw new NotFoundError('Pairing code not found.');
		}
		if (request.status !== 'pending') {
			throw new AppError(400, 'Pairing code is no longer pending.');
		}
		if (Date.now() > request.expiresAt) {
			await this.agentStore.updatePairingRequest(request.id, { status: 'expired' });
			throw new AppError(400, 'Pairing code has expired.');
		}

		const agentId = 'agt_' + generateUID(10);
		const agentSecret = 'agts_' + randomBytes(24).toString('hex');
		const agentRecord = this.buildAgentRecordFromPairing(request, agentId, agentSecret);

		await this.agentStore.createAgent(agentRecord);
		await this.agentStore.updatePairingRequest(request.id, {
			status: 'approved',
			approvedAt: Date.now(),
			agentId,
			agentSecret,
		});

		return { agentId, name: agentRecord.name, platform: agentRecord.platform };
	}

	async fetchPairingCredentials(pairingCode: string): Promise<{
		approved: boolean;
		agentId?: string;
		agentSecret?: string;
		heartbeatIntervalSec?: number;
		pollIntervalSec?: number;
	}> {
		const request = await this.agentStore.getPairingRequestByCode(pairingCode);
		if (!request) {
			throw new NotFoundError('Pairing code not found.');
		}
		if (request.status === 'pending') {
			if (Date.now() > request.expiresAt) {
				await this.agentStore.updatePairingRequest(request.id, { status: 'expired' });
				throw new AppError(400, 'Pairing code has expired.');
			}
			return { approved: false };
		}
		if (request.status !== 'approved' || !request.agentId || !request.agentSecret) {
			throw new AppError(400, 'Pairing was not approved.');
		}

		if (!request.credentialsFetchedAt) {
			await this.agentStore.updatePairingRequest(request.id, { credentialsFetchedAt: Date.now() });
		}

		return {
			approved: true,
			agentId: request.agentId,
			agentSecret: request.agentSecret,
			heartbeatIntervalSec: 30,
			pollIntervalSec: 15,
		};
	}

	async createJob(input: {
		planId?: string;
		targetAgentId: string;
		payload: AgentJobPayload;
	}): Promise<AgentJobRecord> {
		const target = await this.agentStore.getAgentById(input.targetAgentId);
		if (!target) {
			throw new NotFoundError('Target agent not found.');
		}

		this.ensureBackupPolicy(input.payload, target);

		const job: AgentJobRecord = {
			id: 'job_' + generateUID(12),
			planId: input.planId,
			type: 'backup.run',
			targetAgentId: input.targetAgentId,
			status: 'assigned',
			payload: input.payload,
			issuedAt: Date.now(),
		};
		await this.agentStore.createJob(job);
		return job;
	}

	async pullJobs(agentId: string): Promise<AgentJobRecord[]> {
		const jobs = await this.agentStore.getPendingJobsForAgent(agentId);
		for (const job of jobs) {
			if (job.status === 'assigned') {
				await this.agentStore.updateJob(job.id, { status: 'acknowledged', startedAt: Date.now() });
			}
		}
		return this.agentStore.getPendingJobsForAgent(agentId);
	}

	async updateJobProgress(agentId: string, jobId: string, progress: AgentJobRecord['progress']): Promise<void> {
		const job = await this.agentStore.getJobById(jobId);
		if (!job) {
			throw new NotFoundError('Job not found.');
		}
		if (job.targetAgentId !== agentId) {
			throw new AppError(403, 'Job does not belong to this agent.');
		}
		const nextStatus = job.cancelRequested ? 'cancelled' : 'running';
		await this.agentStore.updateJob(jobId, { progress, status: nextStatus });
	}

	async completeJob(
		agentId: string,
		jobId: string,
		payload: { status: 'completed' | 'failed' | 'cancelled'; summary?: Record<string, any>; error?: string }
	): Promise<void> {
		const job = await this.agentStore.getJobById(jobId);
		if (!job) {
			throw new NotFoundError('Job not found.');
		}
		if (job.targetAgentId !== agentId) {
			throw new AppError(403, 'Job does not belong to this agent.');
		}
		await this.agentStore.updateJob(jobId, {
			status: payload.status,
			result: payload.summary,
			error: payload.error,
			endedAt: Date.now(),
		});
	}

	async cancelJob(jobId: string): Promise<void> {
		const job = await this.agentStore.getJobById(jobId);
		if (!job) {
			throw new NotFoundError('Job not found.');
		}
		if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
			return;
		}
		await this.agentStore.updateJob(jobId, { cancelRequested: true, status: 'cancelled', endedAt: Date.now() });
	}
}
