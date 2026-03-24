import fs from 'fs/promises';
import path from 'path';
import { appPaths } from '../utils/AppPaths';
import {
	AgentJobRecord,
	AgentPairingRequest,
	AgentRecord,
	AgentsDataFile,
	EnrollmentTokenRecord,
} from '../types/agents';

export class AgentStore {
	private readonly filePath: string;
	private writeChain: Promise<void> = Promise.resolve();

	constructor(filePath?: string) {
		this.filePath = filePath || path.join(appPaths.getDataDir(), 'agents.json');
	}

	private async ensureFile(): Promise<void> {
		try {
			await fs.access(this.filePath);
		} catch {
			const initial: AgentsDataFile = { tokens: [], agents: [], jobs: [], pairingRequests: [] };
			await fs.writeFile(this.filePath, JSON.stringify(initial, null, 2), 'utf8');
		}
	}

	private async readData(): Promise<AgentsDataFile> {
		await this.ensureFile();
		const raw = await fs.readFile(this.filePath, 'utf8');
		try {
			const parsed = JSON.parse(raw) as AgentsDataFile;
			return {
				tokens: parsed.tokens || [],
				agents: parsed.agents || [],
				jobs: parsed.jobs || [],
				pairingRequests: parsed.pairingRequests || [],
			};
		} catch {
			return { tokens: [], agents: [], jobs: [], pairingRequests: [] };
		}
	}

	private async writeData(data: AgentsDataFile): Promise<void> {
		this.writeChain = this.writeChain.then(async () => {
			await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
		});
		await this.writeChain;
	}

	async createEnrollmentToken(token: EnrollmentTokenRecord): Promise<void> {
		const data = await this.readData();
		data.tokens.push(token);
		await this.writeData(data);
	}

	async getEnrollmentTokenById(id: string): Promise<EnrollmentTokenRecord | null> {
		const data = await this.readData();
		return data.tokens.find(t => t.id === id) || null;
	}

	async findEnrollmentTokenByHash(tokenHash: string): Promise<EnrollmentTokenRecord | null> {
		const data = await this.readData();
		return data.tokens.find(t => t.tokenHash === tokenHash) || null;
	}

	async updateEnrollmentToken(id: string, updates: Partial<EnrollmentTokenRecord>): Promise<void> {
		const data = await this.readData();
		data.tokens = data.tokens.map(t => (t.id === id ? { ...t, ...updates } : t));
		await this.writeData(data);
	}

	async createAgent(agent: AgentRecord): Promise<void> {
		const data = await this.readData();
		data.agents.push(agent);
		await this.writeData(data);
	}

	async updateAgent(id: string, updates: Partial<AgentRecord>): Promise<void> {
		const data = await this.readData();
		data.agents = data.agents.map(a => (a.id === id ? { ...a, ...updates } : a));
		await this.writeData(data);
	}

	async getAgentById(id: string): Promise<AgentRecord | null> {
		const data = await this.readData();
		return data.agents.find(a => a.id === id) || null;
	}

	async getAgents(): Promise<AgentRecord[]> {
		const data = await this.readData();
		return data.agents;
	}

	async createJob(job: AgentJobRecord): Promise<void> {
		const data = await this.readData();
		data.jobs.push(job);
		await this.writeData(data);
	}

	async getJobById(id: string): Promise<AgentJobRecord | null> {
		const data = await this.readData();
		return data.jobs.find(j => j.id === id) || null;
	}

	async updateJob(id: string, updates: Partial<AgentJobRecord>): Promise<void> {
		const data = await this.readData();
		data.jobs = data.jobs.map(j => (j.id === id ? { ...j, ...updates } : j));
		await this.writeData(data);
	}

	async getPendingJobsForAgent(agentId: string): Promise<AgentJobRecord[]> {
		const data = await this.readData();
		return data.jobs.filter(
			j =>
				j.targetAgentId === agentId &&
				(j.status === 'assigned' || j.status === 'acknowledged' || j.status === 'running')
		);
	}

	async createPairingRequest(request: AgentPairingRequest): Promise<void> {
		const data = await this.readData();
		data.pairingRequests.push(request);
		await this.writeData(data);
	}

	async getPairingRequestByCode(pairingCode: string): Promise<AgentPairingRequest | null> {
		const data = await this.readData();
		return data.pairingRequests.find(p => p.pairingCode === pairingCode) || null;
	}

	async updatePairingRequest(
		id: string,
		updates: Partial<AgentPairingRequest>
	): Promise<void> {
		const data = await this.readData();
		data.pairingRequests = data.pairingRequests.map(p => (p.id === id ? { ...p, ...updates } : p));
		await this.writeData(data);
	}
}
