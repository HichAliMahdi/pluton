import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'react-toastify';
import { useCheckActiveBackupsOrRestore } from '../../../services/plans';
import classes from './PlanPendingBackup.module.scss';
import Icon from '../../common/Icon/Icon';

interface PlanPendingBackup {
   planId: string;
   type?: 'backup' | 'restore';
   onPendingDetect: () => void;
}

const PlanPendingBackup = ({ planId, type = 'backup', onPendingDetect }: PlanPendingBackup) => {
   const [, setSearchParams] = useSearchParams();
   const checkActivesMutation = useCheckActiveBackupsOrRestore();

   useEffect(() => {
      const startedAt = Date.now();
      const timeoutMs = 120000;

      const interval = window.setInterval(() => {
    	 // Prevent infinite "Starting..." state if backend never creates an active item.
    	 if (Date.now() - startedAt > timeoutMs) {
    	 	window.clearInterval(interval);
    	 	setSearchParams((params) => {
    	 		if (type === 'restore') {
    	 			params.delete('pendingrestore');
    	 		} else {
    	 			params.delete('pendingbackup');
    	 		}

    	 		return params;
    	 	});
    	 	toast.error(`${type === 'restore' ? 'Restore' : 'Backup'} is taking too long to start. Please check plan logs for details.`);
    	 	onPendingDetect();
    	 	return;
    	 }

         checkActivesMutation.mutate(
            { planId, type },
            {
               onSuccess: (data) => {
                  console.log('[isBackupPending] data :', data);
                  if (data.result) {
                     window.clearInterval(interval);
                     setSearchParams((params) => {
                        if (type === 'restore') {
                           params.delete('pendingrestore');
                        } else {
                           params.delete('pendingbackup');
                        }

                        return params;
                     });
                     onPendingDetect();
                  }
               },
            },
         );
      }, 1000);

      return () => window.clearInterval(interval);
   }, [planId, type, onPendingDetect, setSearchParams]);

   return (
      <div className={classes.backup}>
         <div className={classes.backupIcon}>
            <Icon type="loading" size={24} />
         </div>
         <div className={classes.backupLeft}>
            <div className={classes.backupId}>Starting {type}...</div>
            <div className={classes.backupStart}>
               <div>
                  <Icon type="clock" size={12} /> Starting in a few seconds
               </div>
            </div>
         </div>
         <div className={classes.backupRight}>
            <span className={`skeleton-box ${classes.progressSkeleton}`} />
         </div>
      </div>
   );
};
export default PlanPendingBackup;
