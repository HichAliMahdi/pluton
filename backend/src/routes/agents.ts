import { Router } from 'express';
import authM from '../middlewares/authMiddleware';
import { AgentController } from '../controllers/AgentController';

export function createAgentRouter(
	controller: AgentController,
	router: Router = Router()
): Router {
	// Console-side endpoints (authenticated user/API key)
	router.post('/enrollment-tokens', authM, controller.createEnrollmentToken.bind(controller));
	router.get('/', authM, controller.listAgents.bind(controller));
	router.get('/manage/:agentId/backup-config', authM, controller.getAgentBackupConfig.bind(controller));
	router.put('/manage/:agentId/backup-config', authM, controller.setAgentBackupConfig.bind(controller));
	router.post('/manage/:agentId/backup/run-now', authM, controller.runAgentBackupNow.bind(controller));
	router.delete('/manage/:agentId', authM, controller.unregisterAgent.bind(controller));
	router.post('/pairing/approve', authM, controller.approvePairing.bind(controller));
	router.post('/jobs', authM, controller.dispatchJob.bind(controller));
	router.post('/jobs/:jobId/cancel', authM, controller.cancelJob.bind(controller));
	router.get('/installers/:platform', authM, controller.downloadInstaller.bind(controller));

	// Agent-side endpoints (agent credentials)
	router.post('/enroll', controller.enroll.bind(controller));
	router.post('/pairing/request', controller.requestPairing.bind(controller));
	router.post('/pairing/fetch', controller.fetchPairing.bind(controller));
	router.get('/self/backup-config', controller.getSelfBackupConfig.bind(controller));
	router.put('/self/backup-config', controller.setSelfBackupConfig.bind(controller));
	router.post('/self/backup/run-now', controller.runSelfBackupNow.bind(controller));
	router.post('/heartbeat', controller.heartbeat.bind(controller));
	router.post('/jobs/pull', controller.pullJobs.bind(controller));
	router.post('/jobs/:jobId/progress', controller.updateJobProgress.bind(controller));
	router.post('/jobs/:jobId/result', controller.completeJob.bind(controller));

	return router;
}
