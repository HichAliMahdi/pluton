import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import classes from './Agents.module.scss';
import PageHeader from '../../components/common/PageHeader/PageHeader';
import Input from '../../components/common/form/Input/Input';
import Icon from '../../components/common/Icon/Icon';
import {
   useApprovePairingCode,
   useDownloadAgentInstaller,
   useGetAgents,
   useUnregisterAgent,
} from '../../services/agents';
import { formatDateTime, timeAgo } from '../../utils/helpers';

const Agents = () => {
   const [pairingCode, setPairingCode] = useState('');
   const { data, isLoading } = useGetAgents();
   const approveMutation = useApprovePairingCode();
   const downloadMutation = useDownloadAgentInstaller();
   const unregisterMutation = useUnregisterAgent();

   const agents = useMemo(() => data?.result || [], [data]);

   const approveCode = async () => {
      const normalizedCode = pairingCode.trim().toUpperCase();
      if (!normalizedCode) {
         toast.error('Please enter a pairing code from the client agent.');
         return;
      }
      try {
         const res = await approveMutation.mutateAsync(normalizedCode);
         toast.success(`Agent ${res?.result?.name || ''} registered successfully.`);
         setPairingCode('');
      } catch (error: any) {
         toast.error(error?.message || 'Failed to approve pairing code.');
      }
   };

   const downloadInstaller = async (platform: 'windows' | 'linux') => {
      try {
         await downloadMutation.mutateAsync(platform);
         toast.success(`Downloading ${platform === 'windows' ? '.exe' : '.deb'} installer...`);
      } catch (error: any) {
         toast.error(error?.message || 'Installer is not available yet.');
      }
   };

   const unregister = async (agent: any) => {
      const ok = window.confirm(`Unregister computer \"${agent.name}\"? This removes its queued jobs and local backup configuration.`);
      if (!ok) return;

      try {
         await unregisterMutation.mutateAsync(agent.id);
         toast.success(`Computer ${agent.name} was unregistered.`);
      } catch (error: any) {
         toast.error(error?.message || 'Failed to unregister computer.');
      }
   };

   return (
      <div className={classes.agentsPage}>
         <PageHeader title="Agents" icon="devices" pageTitle="Agents" />

         <div className={classes.cardsGrid}>
            <section className={classes.card}>
               <h3>Download Agent</h3>
               <p className={classes.helper}>Choose a client installer to deploy on the target machine.</p>
               <div className={classes.downloadButtons}>
                  <button onClick={() => downloadInstaller('windows')} disabled={downloadMutation.isPending}>
                     <Icon type={downloadMutation.isPending ? 'loading' : 'download'} size={14} /> Windows .exe
                  </button>
                  <button onClick={() => downloadInstaller('linux')} disabled={downloadMutation.isPending}>
                     <Icon type={downloadMutation.isPending ? 'loading' : 'download'} size={14} /> Linux .deb
                  </button>
               </div>
               <p className={classes.note}>
                  If no installer is downloaded, place your built files under installers/windows or installers/linux on the server.
               </p>
            </section>

            <section className={classes.card}>
               <h3>Register Computer</h3>
               <p className={classes.helper}>Install and run the agent on the client, then enter the pairing token shown there.</p>
               <div className={classes.pairRow}>
                  <Input
                     label="Pairing Token"
                     placeholder="Example: PAIR-A1B2C3"
                     fieldValue={pairingCode}
                     onUpdate={(value) => setPairingCode(value)}
                     full
                     inline={false}
                  />
                  <button onClick={approveCode} disabled={approveMutation.isPending}>
                     <Icon type={approveMutation.isPending ? 'loading' : 'check'} size={14} /> Register
                  </button>
               </div>
            </section>
         </div>

         <section className={classes.card}>
            <h3>Connected Agents</h3>
            {isLoading && <div className={classes.empty}>Loading agents...</div>}
            {!isLoading && agents.length === 0 && <div className={classes.empty}>No agents registered yet.</div>}
            {!isLoading && agents.length > 0 && (
               <div className={classes.tableWrap}>
                  <table className={classes.table}>
                     <thead>
                        <tr>
                           <th>Name</th>
                           <th>Platform</th>
                           <th>Version</th>
                           <th>Status</th>
                           <th>Last Seen</th>
                           <th>Registered</th>
                           <th></th>
                        </tr>
                     </thead>
                     <tbody>
                        {agents.map((agent: any) => (
                           <tr key={agent.id}>
                              <td>
                                 <strong>{agent.name}</strong>
                                 <div className={classes.sub}>{agent.hostname}</div>
                              </td>
                              <td>
                                 {agent.platform} <span className={classes.sub}>{agent.arch}</span>
                              </td>
                              <td>{agent.agentVersion || '-'}</td>
                              <td>
                                 <span className={`${classes.status} ${agent.status === 'online' ? classes.online : classes.offline}`}>
                                    {agent.status}
                                 </span>
                              </td>
                              <td title={formatDateTime(agent.lastSeenAt)}>
                                 {agent.lastSeenAt ? timeAgo(new Date(agent.lastSeenAt)) : '-'}
                              </td>
                              <td>{agent.registeredAt ? formatDateTime(agent.registeredAt) : '-'}</td>
                              <td>
                                 <button
                                    className={classes.unregisterBtn}
                                    onClick={() => unregister(agent)}
                                    disabled={unregisterMutation.isPending}
                                 >
                                    <Icon type={unregisterMutation.isPending ? 'loading' : 'trash'} size={12} /> Unregister
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
         </section>
      </div>
   );
};

export default Agents;
