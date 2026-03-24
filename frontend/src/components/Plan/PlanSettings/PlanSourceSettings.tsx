import classes from './PlanSettings.module.scss';
import PathPicker from '../../common/PathPicker/PathPicker';
import { NewPlanSettings } from '../../../@types/plans';
import { useGetDevices } from '../../../services/devices';
import { useGetSources } from '../../../services/sources';
import Select from '../../common/form/Select/Select';
import Input from '../../common/form/Input/Input';
import { Device } from '../../../@types/devices';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { API_URL } from '../../../utils/constants';

interface PlanSourceSettingsProps {
   plan: NewPlanSettings;
   isEditing: boolean;
   onUpdate: (plan: NewPlanSettings) => void;
   error: string;
}

const PlanSourceSettings = ({ plan, onUpdate, error, isEditing }: PlanSourceSettingsProps) => {
   const { data } = useGetDevices();
   const { data: sourceData } = useGetSources();
   const [selectedServerSourceId, setSelectedServerSourceId] = useState('');
   const [testConnectionStatus, setTestConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
   const [testConnectionMessage, setTestConnectionMessage] = useState('');
   
   const deviceList = [];
   const deviceId = plan.sourceId || 'main';
   const sourceType = plan.sourceType || 'device';
   const dbSource = plan.sourceConfig.database || {
      engine: 'mysql' as const,
      host: '',
      port: 3306,
      user: '',
      password: '',
      database: '',
   };

   const handleTestConnection = async () => {
      if (!dbSource.engine || !dbSource.host || !dbSource.port || !dbSource.user || !dbSource.password || !dbSource.database) {
         toast.error('Please fill in all database configuration fields first');
         return;
      }
      setTestConnectionStatus('testing');
      setTestConnectionMessage('Testing connection...');
      
      try {
         const response = await fetch(`${API_URL}/plans/test/database`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dbSource),
         });
         
         const data = await response.json();
         
         if (!response.ok || !data.success) {
            setTestConnectionStatus('error');
            setTestConnectionMessage(data.error || 'Connection failed');
            toast.error(data.error || 'Failed to connect to database', { autoClose: 5000 });
         } else {
            setTestConnectionStatus('success');
            setTestConnectionMessage(data.message || 'Connection successful!');
            toast.success(data.message || 'Database connection successful!', { autoClose: 3000 });
         }
      } catch (error: any) {
         setTestConnectionStatus('error');
         const errorMessage = error?.message || 'Connection test failed';
         setTestConnectionMessage(errorMessage);
         toast.error(errorMessage, { autoClose: 5000 });
      }
   };

   if (data?.success && data.result) {
      deviceList.push(
         ...data.result.map((device: Device) => ({
            label: `${device.name} ${device.id === 'main' ? '(Main)' : ''}`,
            value: device.id,
            icon: device.id === 'main' ? 'computer' : 'computer-remote',
            // disabled: device.id === 'main' || device.connected ? false : true,
         })),
      );
   }

   const serverSources = sourceData?.result || [];
   const serverSourceOptions = useMemo(
      () =>
         serverSources
            .filter((item: { enabled?: boolean }) => item.enabled !== false)
            .map((item: { id: string; name: string; path: string }) => ({
               label: `${item.name} (${item.path})`,
               value: item.id,
               icon: 'folders',
            })),
      [serverSources],
   );

   useEffect(() => {
      if (sourceType !== 'server') return;
      if (selectedServerSourceId) return;
      if (plan.sourceId && plan.sourceId !== 'main') {
         setSelectedServerSourceId(plan.sourceId);
         return;
      }
      const currentPath = plan.sourceConfig?.includes?.[0];
      if (!currentPath) return;
      const matched = serverSources.find(
         (item: { id: string; path: string }) => item.path === currentPath
      );
      if (matched) {
         setSelectedServerSourceId(matched.id);
      }
   }, [sourceType, selectedServerSourceId, plan.sourceConfig, serverSources]);

   return (
      <>
         <div className={classes.field}>
            <label className={classes.label}>Source Type*</label>
            <Select
               options={[
                  { label: 'Device Source', value: 'device', icon: 'computer' },
                  { label: 'Server Source', value: 'server', icon: 'server' },
                  { label: 'Database Source', value: 'database', icon: 'database' },
               ]}
               fieldValue={sourceType}
               disabled={isEditing}
               full={true}
               onUpdate={(val) =>
                  onUpdate({
                     ...plan,
                     sourceType: val as NewPlanSettings['sourceType'],
                     sourceId: 'main',
                     sourceConfig:
                        val === 'database'
                           ? {
                                includes: [],
                                excludes: [],
                                database: dbSource,
                             }
                           : {
                                includes: plan.sourceConfig.includes || [],
                                excludes: plan.sourceConfig.excludes || [],
                             },
                  })
               }
            />
         </div>

         {sourceType === 'device' && (
            <>
         <div className={classes.field}>
            <label className={classes.label}>Select Device*</label>
            <Select
               options={deviceList}
               fieldValue={deviceId}
               disabled={isEditing}
               full={true}
               onUpdate={(val) => onUpdate({ ...plan, sourceId: val })}
            />
         </div>
         <div className={classes.field}>
            <label className={classes.label}>Backup Sources*</label>
            {error && <span className={classes.fieldErrorLabel}>{error}</span>}
            <PathPicker
               paths={{ includes: plan.sourceConfig.includes, excludes: plan.sourceConfig.excludes }}
               onUpdate={(paths) => onUpdate({ ...plan, sourceConfig: { ...paths } })}
               deviceId={deviceId}
               single={plan.method === 'sync'}
               disallowChange={plan.method === 'sync'}
            />
         </div>
            </>
         )}

         {sourceType === 'server' && (
            <>
               <div className={classes.field}>
                  <label className={classes.label}>Select Server Source*</label>
                  <Select
                     options={serverSourceOptions}
                     fieldValue={selectedServerSourceId}
                     full={true}
                     disabled={isEditing}
                     onUpdate={(id) => {
                        setSelectedServerSourceId(id);
                        const selected = serverSources.find((item: { id: string }) => item.id === id);
                        if (!selected) return;
                        onUpdate({
                           ...plan,
                           sourceId: id,
                           sourceType: 'server',
                           sourceConfig: {
                              includes: [selected.path],
                              excludes: plan.sourceConfig.excludes || [],
                           },
                        });
                     }}
                  />
                  <small className={classes.hintText}>
                     Server sources are centrally managed paths from the Sources page.
                  </small>
               </div>
               <div className={classes.field}>
                  <label className={classes.label}>Selected Source Path</label>
                  <div className={classes.selectedPathLabel}>
                     {plan.sourceConfig.includes[0] || 'No source selected'}
                  </div>
               </div>
            </>
         )}

         {sourceType === 'database' && (
            <>
               <div className={classes.field}>
                  <label className={classes.label}>Database Engine*</label>
                  {error && <span className={classes.fieldErrorLabel}>{error}</span>}
                  <Select
                     options={[
                        { label: 'MySQL', value: 'mysql', icon: 'database' },
                        { label: 'PostgreSQL', value: 'postgres', icon: 'database' },
                        { label: 'MongoDB', value: 'mongodb', icon: 'database' },
                     ]}
                     fieldValue={dbSource.engine}
                     full={true}
                     disabled={isEditing}
                     onUpdate={(engine) =>
                        onUpdate({
                           ...plan,
                           sourceType: 'database',
                           sourceId: 'main',
                           sourceConfig: {
                              includes: [],
                              excludes: [],
                              database: {
                                 ...dbSource,
                                 engine: engine as 'mysql' | 'postgres' | 'mongodb',
                                 port:
                                    engine === 'postgres'
                                       ? 5432
                                       : engine === 'mongodb'
                                          ? 27017
                                          : 3306,
                              },
                           },
                        })
                     }
                  />
               </div>
               <div className={classes.field}>
                  <Input
                     label="Host*"
                     fieldValue={dbSource.host}
                     full={true}
                     disabled={isEditing}
                     onUpdate={(host) =>
                        onUpdate({
                           ...plan,
                           sourceType: 'database',
                           sourceId: 'main',
                           sourceConfig: {
                              includes: [],
                              excludes: [],
                              database: { ...dbSource, host },
                           },
                        })
                     }
                  />
               </div>
               <div className={classes.field}>
                  <Input
                     label="Port*"
                     type="number"
                     fieldValue={dbSource.port}
                     full={true}
                     disabled={isEditing}
                     onUpdate={(port) =>
                        onUpdate({
                           ...plan,
                           sourceType: 'database',
                           sourceId: 'main',
                           sourceConfig: {
                              includes: [],
                              excludes: [],
                              database: { ...dbSource, port: Number(port) || 0 },
                           },
                        })
                     }
                  />
               </div>
               <div className={classes.field}>
                  <Input
                     label="Username*"
                     fieldValue={dbSource.user}
                     full={true}
                     disabled={isEditing}
                     onUpdate={(user) =>
                        onUpdate({
                           ...plan,
                           sourceType: 'database',
                           sourceId: 'main',
                           sourceConfig: {
                              includes: [],
                              excludes: [],
                              database: { ...dbSource, user },
                           },
                        })
                     }
                  />
               </div>
               <div className={classes.field}>
                  <Input
                     label="Password*"
                     type="password"
                     fieldValue={dbSource.password}
                     full={true}
                     disabled={isEditing}
                     onUpdate={(password) =>
                        onUpdate({
                           ...plan,
                           sourceType: 'database',
                           sourceId: 'main',
                           sourceConfig: {
                              includes: [],
                              excludes: [],
                              database: { ...dbSource, password },
                           },
                        })
                     }
                  />
               </div>
               <div className={classes.field}>
                  <Input
                     label="Database Name*"
                     fieldValue={dbSource.database}
                     full={true}
                     disabled={isEditing}
                     onUpdate={(database) =>
                        onUpdate({
                           ...plan,
                           sourceType: 'database',
                           sourceId: 'main',
                           sourceConfig: {
                              includes: [],
                              excludes: [],
                              database: { ...dbSource, database },
                           },
                        })
                     }
                  />
               </div>
               <div className={classes.field} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <button
                     type="button"
                     onClick={handleTestConnection}
                     disabled={isEditing || testConnectionStatus === 'testing'}
                     style={{
                        padding: '8px 16px',
                        backgroundColor: testConnectionStatus === 'success' ? '#10b981' : testConnectionStatus === 'error' ? '#ef4444' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isEditing || testConnectionStatus === 'testing' ? 'not-allowed' : 'pointer',
                        opacity: isEditing || testConnectionStatus === 'testing' ? 0.6 : 1,
                        marginTop: '24px',
                        fontSize: '14px',
                        fontWeight: '500'
                     }}
                  >
                     {testConnectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                  </button>
                  {testConnectionMessage && (
                     <span
                        style={{
                           marginTop: '24px',
                           fontSize: '12px',
                           color: testConnectionStatus === 'success' ? '#10b981' : testConnectionStatus === 'error' ? '#ef4444' : '#666',
                           fontWeight: testConnectionStatus !== 'idle' ? 500 : 400
                        }}
                     >
                        {testConnectionMessage}
                     </span>
                  )}
               </div>
               <small className={classes.hintText}>
                  Database backups create a dump snapshot on the server and store it in your selected destination.
               </small>
            </>
         )}
      </>
   );
};

export default PlanSourceSettings;
