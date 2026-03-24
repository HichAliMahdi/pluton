import { Request, Response } from 'express';
import { ServerSourceService } from '../services/ServerSourceService';

export class ServerSourceController {
	constructor(private sourceService: ServerSourceService) {}

	async listSources(_req: Request, res: Response): Promise<void> {
		try {
			const result = await this.sourceService.listSources();
			res.json({ success: true, result });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error?.message || 'Failed to list sources' });
		}
	}

	async getSource(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.sourceService.getSource(req.params.id);
			res.json({ success: true, result });
		} catch (error: any) {
			res.status(404).json({ success: false, error: error?.message || 'Source not found' });
		}
	}

	async createSource(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.sourceService.createSource(req.body);
			res.status(201).json({ success: true, result });
		} catch (error: any) {
			const code = typeof error?.statusCode === 'number' ? error.statusCode : 500;
			res.status(code).json({ success: false, error: error?.message || 'Failed to create source' });
		}
	}

	async updateSource(req: Request, res: Response): Promise<void> {
		try {
			const result = await this.sourceService.updateSource(req.params.id, req.body);
			res.json({ success: true, result });
		} catch (error: any) {
			const code = typeof error?.statusCode === 'number' ? error.statusCode : 500;
			res.status(code).json({ success: false, error: error?.message || 'Failed to update source' });
		}
	}

	async deleteSource(req: Request, res: Response): Promise<void> {
		try {
			await this.sourceService.deleteSource(req.params.id);
			res.json({ success: true });
		} catch (error: any) {
			const code = typeof error?.statusCode === 'number' ? error.statusCode : 500;
			res.status(code).json({ success: false, error: error?.message || 'Failed to delete source' });
		}
	}
}
