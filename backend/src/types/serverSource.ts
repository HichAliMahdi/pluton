export type ServerSourceMode = 'local' | 'remote';
export type ServerSourceProtocol = 'sftp' | 'ftp' | 'webdav' | 'smb';

export interface ServerSourceRemote {
	protocol: ServerSourceProtocol;
	host: string;
	port?: number;
	user?: string;
	pass?: string;
	remotePath: string;
	url?: string;
	domain?: string;
	tls?: boolean;
}

export interface ServerSource {
	id: string;
	name: string;
	path: string;
	mode?: ServerSourceMode;
	remote?: ServerSourceRemote;
	description?: string;
	tags?: string[];
	enabled: boolean;
	createdAt: number;
	updatedAt?: number;
}

export interface NewServerSource {
	name: string;
	path: string;
	mode?: ServerSourceMode;
	remote?: ServerSourceRemote;
	description?: string;
	tags?: string[];
	enabled?: boolean;
}
