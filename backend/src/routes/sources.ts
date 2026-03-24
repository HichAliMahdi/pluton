import { Router } from 'express';
import authM from '../middlewares/authMiddleware';
import { ServerSourceController } from '../controllers/ServerSourceController';

export function createSourceRouter(
	controller: ServerSourceController,
	router: Router = Router()
): Router {
	router.get('/', authM, controller.listSources.bind(controller));
	router.get('/:id', authM, controller.getSource.bind(controller));
	router.post('/', authM, controller.createSource.bind(controller));
	router.put('/:id', authM, controller.updateSource.bind(controller));
	router.delete('/:id', authM, controller.deleteSource.bind(controller));
	return router;
}
