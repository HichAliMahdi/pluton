import { promises as fs } from 'fs';
import path from 'path';
import Cryptr from 'cryptr';
import { appPaths } from '../utils/AppPaths';
import { generateUID } from '../utils/helpers';
import { AppError, NotFoundError } from '../utils/AppError';
import { NewServerSource, ServerSource } from '../types/serverSource';
import { configService } from './ConfigService';

export class ServerSourceService {
	private filePath = path.join(appPaths.getConfigDir(), 'server-sources.json');

	private async ensureFile(): Promise<void> {
		try {
			await fs.access(this.filePath);
		} catch {
			await fs.writeFile(this.filePath, '[]', { encoding: 'utf8' });
		}
	}

	private async readAll(): Promise<ServerSource[]> {
		await this.ensureFile();
		const raw = await fs.readFile(this.filePath, 'utf8');
		if (!raw.trim()) return [];
		try {
			const parsed = JSON.parse(raw) as ServerSource[];
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	private async writeAll(sources: ServerSource[]): Promise<void> {
		await fs.writeFile(this.filePath, JSON.stringify(sources, null, 2), { encoding: 'utf8' });
	}

	private getCryptr(): Cryptr {
		return new Cryptr(configService.config.SECRET as string);
	}

	private sanitizeForResponse(source: ServerSource): ServerSource {
		if (!source.remote) return source;
		const { pass, ...remoteWithoutPass } = source.remote;
		return {
			...source,
			remote: remoteWithoutPass,
		};
	}

	private encryptIfNeeded(payload: NewServerSource): NewServerSource {
		if (!payload.remote?.pass) return payload;
		const cryptr = this.getCryptr();
		return {
			...payload,
			remote: {
				...payload.remote,
				pass: cryptr.encrypt(payload.remote.pass),
			},
		};
	}

	private decryptIfNeeded(source: ServerSource): ServerSource {
		if (!source.remote?.pass) return source;
		const cryptr = this.getCryptr();
		try {
			return {
				...source,
				remote: {
					...source.remote,
					pass: cryptr.decrypt(source.remote.pass),
				},
			};
		} catch {
			return source;
		}
	}

	private normalizePath(inputPath: string): string {
		const trimmed = (inputPath || '').trim();
		if (!trimmed) {
			throw new AppError(400, 'Source path is required');
		}
		return path.normalize(trimmed);
	}

	async listSources(): Promise<ServerSource[]> {
		const sources = await this.readAll();
		return sources.map(source => this.sanitizeForResponse(source));
	}

	async getSource(id: string): Promise<ServerSource> {
		const sources = await this.readAll();
		const source = sources.find(s => s.id === id);
		if (!source) {
			throw new NotFoundError('Source not found');
		}
		return this.sanitizeForResponse(source);
	}

	async resolveSourceForBackup(id: string): Promise<ServerSource> {
		const sources = await this.readAll();
		const source = sources.find(s => s.id === id);
		if (!source) {
			throw new NotFoundError('Source not found');
		}
		return this.decryptIfNeeded(source);
	}

	async createSource(payload: NewServerSource): Promise<ServerSource> {
		const name = (payload.name || '').trim();
		if (!name) {
			throw new AppError(400, 'Source name is required');
		}

		const mode = payload.mode || 'local';
		if (mode === 'local' && !payload.path) {
			throw new AppError(400, 'Source path is required for local sources');
		}
		if (mode === 'remote' && !payload.remote) {
			throw new AppError(400, 'Remote source configuration is required');
		}
		const sourcePath = payload.path ? this.normalizePath(payload.path) : '/';
		const payloadToPersist = this.encryptIfNeeded(payload);
		const sources = await this.readAll();
		const duplicate = sources.find(s => s.name.toLowerCase() === name.toLowerCase());
		if (duplicate) {
			throw new AppError(400, 'A source with this name already exists');
		}

		const source: ServerSource = {
			id: generateUID(),
			name,
			path: sourcePath,
			mode,
			remote: payloadToPersist.remote,
			description: payload.description?.trim() || '',
			tags: payload.tags || [],
			enabled: payload.enabled !== false,
			createdAt: Date.now(),
		};

		sources.push(source);
		await this.writeAll(sources);
		return this.sanitizeForResponse(source);
	}

	async updateSource(id: string, payload: Partial<NewServerSource>): Promise<ServerSource> {
		const sources = await this.readAll();
		const index = sources.findIndex(s => s.id === id);
		if (index === -1) {
			throw new NotFoundError('Source not found');
		}

		const current = sources[index];
		const payloadToPersist = this.encryptIfNeeded(payload as NewServerSource);
		const nextName = payload.name !== undefined ? payload.name.trim() : current.name;
		if (!nextName) {
			throw new AppError(400, 'Source name cannot be empty');
		}

		const duplicate = sources.find(
			s => s.id !== id && s.name.toLowerCase() === nextName.toLowerCase()
		);
		if (duplicate) {
			throw new AppError(400, 'A source with this name already exists');
		}

		const updated: ServerSource = {
			...current,
			name: nextName,
			path: payload.path !== undefined ? this.normalizePath(payload.path) : current.path,
			mode: payload.mode !== undefined ? payload.mode : current.mode || 'local',
			remote: payloadToPersist.remote !== undefined ? payloadToPersist.remote : current.remote,
			description: payload.description !== undefined ? payload.description.trim() : current.description,
			tags: payload.tags !== undefined ? payload.tags : current.tags,
			enabled: payload.enabled !== undefined ? payload.enabled : current.enabled,
			updatedAt: Date.now(),
		};

		sources[index] = updated;
		await this.writeAll(sources);
		return this.sanitizeForResponse(updated);
	}

	async deleteSource(id: string): Promise<boolean> {
		const sources = await this.readAll();
		const filtered = sources.filter(s => s.id !== id);
		if (filtered.length === sources.length) {
			throw new NotFoundError('Source not found');
		}
		await this.writeAll(filtered);
		return true;
	}
}
