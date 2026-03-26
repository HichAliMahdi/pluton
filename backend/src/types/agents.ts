export type AgentPlatform = 'linux' | 'windows' | 'darwin' | 'unknown';

export interface AgentCapabilities {
	fileBackup: boolean;
	fullBackup: boolean;
	dbBackup: boolean;
}

export interface EnrollmentTokenRecord {
	id: string;
	name: string;
	tokenHash: string;
	expiresAt: number;
	maxUses: number;
	uses: number;
	allowedPlatforms: AgentPlatform[];
	revoked: boolean;
	createdAt: number;
}

export interface AgentRecord {
	id: string;
	name: string;
	hostname: string;
	platform: AgentPlatform;
	arch: string;
	osVersion: string;
	capabilities: AgentCapabilities;
	agentVersion: string;
	secretHash: string;
	registeredAt: number;
	lastSeenAt: number;
	status: 'online' | 'offline';
}

export interface AgentPairingRequest {
	id: string;
	pairingCode: string;
	agentName: string;
	hostname: string;
	platform: AgentPlatform;
	arch: string;
	osVersion: string;
	agentVersion: string;
	capabilities: AgentCapabilities;
	status: 'pending' | 'approved' | 'expired';
	createdAt: number;
	expiresAt: number;
	approvedAt?: number;
	agentId?: string;
	agentSecret?: string;
	credentialsFetchedAt?: number;
}

export interface AgentBackupConfig {
	agentId: string;
	mode: 'full_backup' | 'path_backup';
	paths: string[];
	excludes?: string[];
	storagePath: string;
	compression: boolean;
	encryption: boolean;
	updatedAt: number;
}

export type AgentJobStatus =
	| 'assigned'
	| 'acknowledged'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled';

export type AgentBackupMode = 'full_backup' | 'path_backup' | 'database_backup';

export interface AgentJobPayload {
	mode: AgentBackupMode;
	sourceType: 'device' | 'database';
	paths: string[];
	excludes?: string[];
	storage: {
		id: string;
		type: string;
		path: string;
	};
	settings?: {
		compression?: boolean;
		encryption?: boolean;
		retries?: number;
	};
	database?: {
		engine: 'mysql' | 'postgres' | 'mongodb';
		host: string;
		port: number;
		user: string;
		database: string;
	};
}

export interface AgentJobRecord {
	id: string;
	planId?: string;
	type: 'backup.run';
	targetAgentId: string;
	status: AgentJobStatus;
	payload: AgentJobPayload;
	issuedAt: number;
	startedAt?: number;
	endedAt?: number;
	cancelRequested?: boolean;
	progress?: {
		percent?: number;
		bytesProcessed?: number;
		totalBytes?: number;
		phase?: string;
		timestamp?: number;
	};
	result?: Record<string, any>;
	error?: string;
}

export interface AgentsDataFile {
	tokens: EnrollmentTokenRecord[];
	agents: AgentRecord[];
	jobs: AgentJobRecord[];
	pairingRequests: AgentPairingRequest[];
	backupConfigs: AgentBackupConfig[];
}
