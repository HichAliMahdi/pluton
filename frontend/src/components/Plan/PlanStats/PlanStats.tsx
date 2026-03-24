import Icon from '../../common/Icon/Icon';
import { Plan } from '../../../@types/plans';
import { formatBytes, formatNumberToK } from '../../../utils/helpers';
import PlanHistory from '../PlanHistory/PlanHistory';
import classes from './PlanStats.module.scss';
import PlanStorageInfo from '../PlanStorageInfo/PlanStorageInfo';

interface PlanStatsProps {
   plan: Plan;
   isSync: boolean;
   lastBackupItem: any;
}

const PlanStats = ({ plan, isSync, lastBackupItem }: PlanStatsProps) => {
   const { sourceConfig, storage, storagePath, isActive, settings } = plan;
   const { interval } = settings;
   const isDatabaseSource = plan.sourceType === 'database' && !!sourceConfig?.database;
   const sourceCount = sourceConfig?.includes?.length
      ? sourceConfig.includes.length
      : isDatabaseSource
         ? 1
         : 0;

   const totalFiles =
      typeof lastBackupItem?.totalFiles === 'number'
         ? lastBackupItem.totalFiles
         : isDatabaseSource
            ? 1
            : 0;
   const totalSize = lastBackupItem?.totalSize || 0;

   const sourceTooltipHTML = (sources: Plan['sourceConfig']) => {
      let html = '';
      if (plan.sourceType === 'database' && sources?.database) {
         const db = sources.database;
         html += `<div><strong>Database Source</strong></div>`;
         html += `<div>Engine: ${db.engine}</div>`;
         html += `<div>Host: ${db.host}:${db.port}</div>`;
         html += `<div>Database: ${db.database}</div>`;
      }
      if (sources && sources.includes && sources.includes.length > 0) {
         html += `<div><strong>Includes</strong></div>`;
         html += sources.includes
            .map((p) => `<div>${plan.device?.name || 'device'} -> ${p}</div>`)
            .join('');
      }
      if (sources && sources.excludes && sources.excludes.length > 0) {
         html += `<div><strong>Excludes</strong></div>`;
         html += sources.excludes.map((p) => `<div>${p}</div>`).join('');
      }
      return html;
   };

   return (
      <div className={classes.planStats}>
         <div className={classes.sources}>
            <div className={classes.widgetTitle}>
               <Icon type="backup" size={12} /> {isSync ? 'Syncing' : 'Backing Up'}
            </div>
            <div className={classes.sourceContent}>
               <div data-tooltip-id="htmlToolTip" data-tooltip-place="top" data-tooltip-html={sourceTooltipHTML(sourceConfig)}>
                  <Icon type="folders" size={18} />
                  <span>{sourceCount} Sources</span>
               </div>
               <div
                  data-tooltip-id="htmlToolTip"
                  data-tooltip-place="top"
                  data-tooltip-html={
                     isActive
                        ? isSync
                           ? `Syncing changes every ${interval.minutes} minutes`
                           : `Copying changes ${['hours', 'minutes', 'days'].includes(interval.type) ? interval[interval.type as 'hours' | 'minutes' | 'days'] + interval.type : interval.type}`
                        : 'Plan is Not Active'
                  }
               >
                  <Icon type={isActive ? (isSync ? 'reload' : 'copy') : 'pause'} size={16} />
                  <div className={classes.sourceArrow}>→</div>
               </div>
               <PlanStorageInfo
                  disableTooltip={false}
                  inline={false}
                  replicationSettings={plan.settings.replication}
                  storage={storage}
                  storagePath={storagePath}
               />
            </div>
         </div>
         <div className={classes.snapshots}>
            <div className={classes.widgetTitle}>
               <Icon type="folders" size={12} /> Source Stats
            </div>
            <div className={classes.snapshotsContent}>
               <div>
                  <span>{totalFiles ? formatNumberToK(totalFiles) : 0}</span>
                  <span>Files</span>
               </div>
               <div></div>
               <div>
                  <span>{totalSize ? formatBytes(totalSize) : '0.00B'}</span>
                  <span>Size</span>
               </div>
            </div>
         </div>
         <div className={classes.health}>
            <div className={classes.widgetTitle}>
               <Icon type="speed" size={12} /> Health
            </div>
            <div className={classes.healthContent}>
               <PlanHistory planId={plan.id} history={plan.backups} itemsCount={90} />
            </div>
         </div>
      </div>
   );
};

export default PlanStats;
