import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import PageHeader from '../../components/common/PageHeader/PageHeader';
import SearchItems from '../../components/common/SearchItems/SearchItems';
import Modal from '../../components/common/Modal/Modal';
import Input from '../../components/common/form/Input/Input';
import Select from '../../components/common/form/Select/Select';
import Icon from '../../components/common/Icon/Icon';
import classes from './Sources.module.scss';
import {
   useCreateSource,
   useDeleteSource,
   useGetSources,
} from '../../services/sources';
import { ServerSource, ServerSourceMode, ServerSourceProtocol } from '../../@types/sources';

type SourcesProps = { buttonTitle?: string; buttonAction?: (bool: boolean) => void };

const Sources = ({ buttonTitle, buttonAction }: SourcesProps) => {
   const [searchTerm, setSearchTerm] = useState('');
   const [showCreateModal, setShowCreateModal] = useState(false);
   const [newName, setNewName] = useState('');
   const [newPath, setNewPath] = useState('');
   const [newDescription, setNewDescription] = useState('');
   const [sourceMode, setSourceMode] = useState<ServerSourceMode>('local');
   const [remoteProtocol, setRemoteProtocol] = useState<ServerSourceProtocol>('sftp');
   const [remoteHost, setRemoteHost] = useState('');
   const [remotePort, setRemotePort] = useState('');
   const [remoteUser, setRemoteUser] = useState('');
   const [remotePass, setRemotePass] = useState('');
   const [remotePath, setRemotePath] = useState('/');
   const [remoteUrl, setRemoteUrl] = useState('');
   const [remoteDomain, setRemoteDomain] = useState('');
   const [remoteTls, setRemoteTls] = useState('true');
   const { data, isLoading } = useGetSources();
   const createSource = useCreateSource();
   const deleteSource = useDeleteSource();
   const sources: ServerSource[] = data?.result || [];

   const filteredSources = useMemo(() => {
      if (!searchTerm) return sources;
      const query = searchTerm.toLowerCase();
      return sources.filter(s =>
         s.name.toLowerCase().includes(query) ||
         s.path.toLowerCase().includes(query) ||
         (s.description || '').toLowerCase().includes(query)
      );
   }, [sources, searchTerm]);

   const onCreate = () => {
      if (!newName.trim()) {
         toast.error('Name is required');
         return;
      }

      if (sourceMode === 'local' && !newPath.trim()) {
         toast.error('Path is required for local sources');
         return;
      }

      if (sourceMode === 'remote') {
         if (!remotePath.trim()) {
            toast.error('Remote path is required');
            return;
         }
         if (remoteProtocol === 'webdav') {
            if (!remoteUrl.trim() && !remoteHost.trim()) {
               toast.error('WebDAV requires URL or host');
               return;
            }
         } else if (!remoteHost.trim()) {
            toast.error('Host is required for remote sources');
            return;
         }
      }

      const parsedPort = remotePort.trim() ? Number(remotePort.trim()) : undefined;
      const payload = {
         name: newName.trim(),
         path: sourceMode === 'local' ? newPath.trim() : remotePath.trim(),
         mode: sourceMode,
         description: newDescription.trim(),
         enabled: true,
         ...(sourceMode === 'remote'
            ? {
                 remote: {
                    protocol: remoteProtocol,
                    host: remoteHost.trim(),
                    ...(parsedPort ? { port: parsedPort } : {}),
                    user: remoteUser.trim(),
                    pass: remotePass,
                    remotePath: remotePath.trim(),
                    ...(remoteProtocol === 'webdav' ? { url: remoteUrl.trim(), tls: remoteTls === 'true' } : {}),
                    ...(remoteProtocol === 'smb' ? { domain: remoteDomain.trim() } : {}),
                 },
              }
            : {}),
      };

      createSource.mutate(
         payload,
         {
            onSuccess: () => {
               toast.success('Source added');
               setShowCreateModal(false);
               setNewName('');
               setNewPath('');
               setNewDescription('');
               setSourceMode('local');
               setRemoteProtocol('sftp');
               setRemoteHost('');
               setRemotePort('');
               setRemoteUser('');
               setRemotePass('');
               setRemotePath('/');
               setRemoteUrl('');
               setRemoteDomain('');
               setRemoteTls('true');
            },
            onError: (error: Error) => toast.error(error.message || 'Failed to add source'),
         },
      );
   };

   const onDelete = (source: ServerSource) => {
      if (!window.confirm(`Delete source "${source.name}"?`)) return;
      deleteSource.mutate(source.id, {
         onSuccess: () => toast.success('Source removed'),
         onError: (error: Error) => toast.error(error.message || 'Failed to remove source'),
      });
   };

   return (
      <div className={classes.devices}>
         <PageHeader
            title="Server Sources"
            icon="sources"
            buttonTitle={buttonTitle || 'Add Source'}
            buttonAction={buttonAction || (() => setShowCreateModal(true))}
            rightSection={
               <>
                  <SearchItems onSearch={(term) => setSearchTerm(term)} itemName="Sources" />
               </>
            }
         />
         <div className={classes.deviceItems}>
            {!isLoading && filteredSources.length === 0 && (
               <div className={classes.emptySources}>No server sources yet. Add your first source path.</div>
            )}
            {!isLoading && filteredSources.length > 0 && filteredSources.map((source) => (
               <div key={source.id} className={classes.sourceItem}>
                  <div className={classes.sourceItemMain}>
                     <div className={classes.sourceName}><Icon type="folders" /> {source.name}</div>
                     <div className={classes.sourceBadges}>
                        <span className={classes.modeBadge}>{source.mode || 'local'}</span>
                        {source.mode === 'remote' && source.remote?.protocol && (
                           <span className={classes.protocolBadge}>{source.remote.protocol}</span>
                        )}
                     </div>
                     <div className={classes.sourcePath}>{source.path}</div>
                     {source.description && <div className={classes.sourceDescription}>{source.description}</div>}
                  </div>
                  <div className={classes.sourceActions}>
                     <button className={classes.deleteBtn} onClick={() => onDelete(source)}>
                        <Icon type="trash" size={12} /> Delete
                     </button>
                  </div>
               </div>
            ))}
         </div>

         {showCreateModal && (
            <Modal title="Add Server Source" closeModal={() => setShowCreateModal(false)} width="560px">
               <div className={classes.createSourceForm}>
                  <Input label="Source Name*" fieldValue={newName} onUpdate={setNewName} full={true} />
                  <Select
                     label="Source Mode*"
                     fieldValue={sourceMode}
                     full={true}
                     options={[
                        { label: 'Local Path', value: 'local', icon: 'folders' },
                        { label: 'Remote Connector', value: 'remote', icon: 'server' },
                     ]}
                     onUpdate={(value) => setSourceMode(value as ServerSourceMode)}
                  />
                  {sourceMode === 'local' && (
                     <Input label="Source Path*" fieldValue={newPath} onUpdate={setNewPath} full={true} />
                  )}
                  {sourceMode === 'remote' && (
                     <>
                        <Select
                           label="Protocol*"
                           fieldValue={remoteProtocol}
                           full={true}
                           options={[
                              { label: 'SFTP', value: 'sftp' },
                              { label: 'FTP', value: 'ftp' },
                              { label: 'WebDAV', value: 'webdav' },
                              { label: 'SMB', value: 'smb' },
                           ]}
                           onUpdate={(value) => setRemoteProtocol(value as ServerSourceProtocol)}
                        />
                        {remoteProtocol === 'webdav' && (
                           <Input label="WebDAV URL" fieldValue={remoteUrl} onUpdate={setRemoteUrl} full={true} />
                        )}
                        <Input label="Host" fieldValue={remoteHost} onUpdate={setRemoteHost} full={true} />
                        <Input
                           label="Port"
                           type="number"
                           fieldValue={remotePort}
                           onUpdate={setRemotePort}
                           full={true}
                        />
                        <Input label="Username" fieldValue={remoteUser} onUpdate={setRemoteUser} full={true} />
                        <Input
                           label="Password"
                           type="password"
                           fieldValue={remotePass}
                           onUpdate={setRemotePass}
                           full={true}
                        />
                        {remoteProtocol === 'smb' && (
                           <Input label="Domain" fieldValue={remoteDomain} onUpdate={setRemoteDomain} full={true} />
                        )}
                        {remoteProtocol === 'webdav' && (
                           <Select
                              label="Use TLS"
                              fieldValue={remoteTls}
                              full={true}
                              options={[
                                 { label: 'Yes', value: 'true' },
                                 { label: 'No', value: 'false' },
                              ]}
                              onUpdate={setRemoteTls}
                           />
                        )}
                        <Input
                           label="Remote Path*"
                           fieldValue={remotePath}
                           onUpdate={setRemotePath}
                           full={true}
                        />
                     </>
                  )}
                  <Input label="Description" fieldValue={newDescription} onUpdate={setNewDescription} full={true} />
                  <div className="modalActions">
                     <button className="modalButton" onClick={() => setShowCreateModal(false)}>Cancel</button>
                     <button className="modalButton modalButton--ok" onClick={onCreate}>Add Source</button>
                  </div>
               </div>
            </Modal>
         )}
      </div>
   );
};

export default Sources;
