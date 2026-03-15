import { Request, Response, NextFunction } from 'express';
import { getInstallType } from '../utils/installHelpers';
import { configService } from '../services/ConfigService';

// Read package.json once at startup
const appVersion: string = process.env.APP_VERSION || 'dev';

/**
 * Middleware that adds the application version from package.json to response headers
 */
export default function versionMiddleware(req: Request, res: Response, next: NextFunction) {
	// Add version to response headers
	const isSetupPending = configService.isSetupPending();
	res.setHeader('X-App-Version', appVersion);
	res.setHeader('X-Server-OS', process.platform);
	res.setHeader('X-Install-Type', getInstallType());
	res.setHeader('X-Setup-Pending', isSetupPending ? 1 : 0);
	next();
}
