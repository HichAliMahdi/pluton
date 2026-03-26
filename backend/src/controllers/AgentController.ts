import { Request, Response } from 'express';
import { AgentService } from '../services/AgentService';
import { AppError } from '../utils/AppError';

export class AgentController {
	constructor(private readonly agentService: AgentService) {}

	private getAgentCreds(req: Request): { agentId: string; agentSecret: string } {
		const headerId = String(req.headers['x-agent-id'] || '');
		const headerSecret = String(req.headers['x-agent-secret'] || '');
		if (headerId && headerSecret) {
			return { agentId: headerId, agentSecret: headerSecret };
		}

		const bearer = (req.headers.authorization || '').replace('Bearer ', '').trim();
		if (bearer.includes(':')) {
			const [agentId, agentSecret] = bearer.split(':');
			return { agentId, agentSecret };
		}
		if (bearer.includes('.')) {
			const [agentId, agentSecret] = bearer.split('.');
			return { agentId, agentSecret };
		}
		return { agentId: '', agentSecret: '' };
	}

	async createEnrollmentToken(req: Request, res: Response): Promise<void> {
		try {
			const { name, expiresInMinutes, maxUses, allowedPlatforms } = req.body || {};
			if (!name || typeof name !== 'string') {
				res.status(400).json({ success: false, error: 'Token name is required.' });
				return;
			}
			const token = await this.agentService.createEnrollmentToken({
				name,
				expiresInMinutes,
				maxUses,
				allowedPlatforms,
			});
			res.status(201).json({ success: true, result: token });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({
				success: false,
				error: appError.message || 'Failed to create enrollment token.',
			});
		}
	}

	async enroll(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.agentService.enrollAgent(req.body || {});
			res.status(201).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({
				success: false,
				error: appError.message || 'Failed to enroll agent.',
			});
		}
	}

	async requestPairing(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.agentService.createPairingRequest(req.body || {});
			res.status(201).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async approvePairing(req: Request, res: Response): Promise<void> {
		try {
			const pairingCode = String(req.body?.pairingCode || '').trim();
			if (!pairingCode) {
				res.status(400).json({ success: false, error: 'pairingCode is required.' });
				return;
			}
			const result = await this.agentService.approvePairingCode(pairingCode);
			res.status(200).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async fetchPairing(req: Request, res: Response): Promise<void> {
		try {
			const pairingCode = String(req.body?.pairingCode || '').trim();
			if (!pairingCode) {
				res.status(400).json({ success: false, error: 'pairingCode is required.' });
				return;
			}
			const result = await this.agentService.fetchPairingCredentials(pairingCode);
			res.status(200).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async listAgents(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.agentService.listAgents();
			res.status(200).json({ success: true, result });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error?.message || 'Failed to list agents.' });
		}
	}

	async getAgentBackupConfig(req: Request, res: Response): Promise<void> {
		try {
			const agentId = String(req.params.agentId || '').trim();
			if (!agentId) {
				res.status(400).json({ success: false, error: 'agentId is required.' });
				return;
			}
			const result = await this.agentService.getAgentBackupConfig(agentId);
			res.status(200).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async setAgentBackupConfig(req: Request, res: Response): Promise<void> {
		try {
			const agentId = String(req.params.agentId || '').trim();
			if (!agentId) {
				res.status(400).json({ success: false, error: 'agentId is required.' });
				return;
			}
			const result = await this.agentService.setAgentBackupConfig(agentId, req.body || {});
			res.status(200).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async runAgentBackupNow(req: Request, res: Response): Promise<void> {
		try {
			const agentId = String(req.params.agentId || '').trim();
			if (!agentId) {
				res.status(400).json({ success: false, error: 'agentId is required.' });
				return;
			}
			const result = await this.agentService.runAgentBackupFromConfig(agentId);
			res.status(201).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async unregisterAgent(req: Request, res: Response): Promise<void> {
		try {
			const agentId = String(req.params.agentId || '').trim();
			if (!agentId) {
				res.status(400).json({ success: false, error: 'agentId is required.' });
				return;
			}
			const result = await this.agentService.unregisterAgent(agentId);
			res.status(200).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async heartbeat(req: Request, res: Response): Promise<void> {
		try {
			const { agentId, agentSecret } = this.getAgentCreds(req);
			const agent = await this.agentService.authenticateAgent(agentId, agentSecret);
			await this.agentService.heartbeat(agent.id);
			res.status(200).json({ success: true, result: { status: 'ok', ts: Date.now() } });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async getSelfBackupConfig(req: Request, res: Response): Promise<void> {
		try {
			const { agentId, agentSecret } = this.getAgentCreds(req);
			const agent = await this.agentService.authenticateAgent(agentId, agentSecret);
			const result = await this.agentService.getAgentBackupConfig(agent.id);
			res.status(200).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async setSelfBackupConfig(req: Request, res: Response): Promise<void> {
		try {
			const { agentId, agentSecret } = this.getAgentCreds(req);
			const agent = await this.agentService.authenticateAgent(agentId, agentSecret);
			const result = await this.agentService.setAgentBackupConfig(agent.id, req.body || {});
			res.status(200).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async runSelfBackupNow(req: Request, res: Response): Promise<void> {
		try {
			const { agentId, agentSecret } = this.getAgentCreds(req);
			const agent = await this.agentService.authenticateAgent(agentId, agentSecret);
			const result = await this.agentService.runAgentBackupFromConfig(agent.id);
			res.status(201).json({ success: true, result });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async dispatchJob(req: Request, res: Response): Promise<void> {
		try {
			const { planId, targetAgentId, payload } = req.body || {};
			if (!targetAgentId || !payload) {
				res.status(400).json({ success: false, error: 'targetAgentId and payload are required.' });
				return;
			}
			const job = await this.agentService.createJob({ planId, targetAgentId, payload });
			res.status(201).json({ success: true, result: job });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async pullJobs(req: Request, res: Response): Promise<void> {
		try {
			const { agentId, agentSecret } = this.getAgentCreds(req);
			const agent = await this.agentService.authenticateAgent(agentId, agentSecret);
			await this.agentService.heartbeat(agent.id);
			const jobs = await this.agentService.pullJobs(agent.id);
			res.status(200).json({ success: true, result: jobs });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async updateJobProgress(req: Request, res: Response): Promise<void> {
		try {
			const { agentId, agentSecret } = this.getAgentCreds(req);
			const agent = await this.agentService.authenticateAgent(agentId, agentSecret);
			const { jobId } = req.params;
			await this.agentService.updateJobProgress(agent.id, jobId, req.body || {});
			res.status(200).json({ success: true, result: { updated: true } });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async completeJob(req: Request, res: Response): Promise<void> {
		try {
			const { agentId, agentSecret } = this.getAgentCreds(req);
			const agent = await this.agentService.authenticateAgent(agentId, agentSecret);
			const { jobId } = req.params;
			const { status, summary, error } = req.body || {};
			if (!status || !['completed', 'failed', 'cancelled'].includes(status)) {
				res.status(400).json({ success: false, error: 'Invalid status.' });
				return;
			}
			await this.agentService.completeJob(agent.id, jobId, { status, summary, error });
			res.status(200).json({ success: true, result: { updated: true } });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async cancelJob(req: Request, res: Response): Promise<void> {
		try {
			const { jobId } = req.params;
			await this.agentService.cancelJob(jobId);
			res.status(200).json({ success: true, result: { cancelled: true } });
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message });
		}
	}

	async downloadInstaller(req: Request, res: Response): Promise<void> {
		try {
			const platform = req.params.platform === 'windows' ? 'windows' : req.params.platform === 'linux' ? 'linux' : null;
			if (!platform) {
				res.status(400).json({ success: false, error: 'Platform must be windows or linux.' });
				return;
			}

			const installer = await this.agentService.resolveInstallerDownload(platform);
			res.download(installer.filePath, installer.filename);
		} catch (error: any) {
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({ success: false, error: appError.message || 'Failed to download installer.' });
		}
	}
}
