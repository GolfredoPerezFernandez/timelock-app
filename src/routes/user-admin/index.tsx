import { component$, useSignal, $ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, zod$, z } from '@builder.io/qwik-city';
import { tursoClient } from '~/utils/turso';
import { getSession } from '~/utils/auth';

export const useAuthLoader = routeLoader$(async (event) => {
  const session = await getSession(event);
  if (!session?.isAuthenticated && !session?.is_admin) {
    throw event.redirect(302, '/auth');
  }
  return session;
});
import { 
  LuUsers, 
  LuPlus, 
  LuTrash,
  LuSave,
  LuX,
  LuLoader2,
  LuAlertTriangle,
  LuShieldCheck,
  LuShieldOff,
  LuPencil
} from '@qwikest/icons/lucide';

// Type Definitions
interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'manager' | 'viewer';
  email: string;
  active: boolean;
}

// Data Loader
export const useUsersLoader = routeLoader$(async (requestEvent) => {
  const db = tursoClient(requestEvent);
  try {
    const result = await db.execute('SELECT id, username, name, role, email, active FROM users ORDER BY name ASC');
    return (result.rows as any[]).map(row => ({
      ...row,
      active: Boolean(row.active)
    })) as User[];
  } catch (error) {
    console.error('Error loading users:', error);
    return [];
  }
});

// Create/Update User Action
export const useSaveUser = routeAction$(
  async (data, requestEvent) => {
    const session = await getSession(requestEvent);
    if (!session.isAuthenticated || !session.is_admin) return { success: false, error: 'Unauthorized' };

    const db = tursoClient(requestEvent);
    const { id, username, name, role, email, password } = data;

    try {
      if (id) { // Update existing user
        const fieldsToUpdate = [
          { key: 'username', value: username },
          { key: 'name', value: name },
          { key: 'role', value: role },
          { key: 'email', value: email },
        ];
        // Only update password if a new one is provided
        if (password) {
          // IMPORTANT: In a real app, hash the password securely!
          // e.g., const hashedPassword = await bcrypt.hash(password, 10);
          fieldsToUpdate.push({ key: 'password_hash', value: password });
        }
        
        const setClauses = fieldsToUpdate.map(f => `${f.key} = ?`).join(', ');
        const args = fieldsToUpdate.map(f => f.value);
        args.push(String(id));

        await db.execute({
          sql: `UPDATE users SET ${setClauses} WHERE id = ?`,
          args: args
        });
      } else { // Create new user
        // IMPORTANT: In a real app, hash the password securely!
        const hashedPassword = password; 
        await db.execute({
          sql: 'INSERT INTO users (username, name, role, email, password_hash, active) VALUES (?, ?, ?, ?, ?, ?)',
          args: [username ?? '', name ?? '', role ?? 'viewer', email ?? '', hashedPassword ?? '', true]
        });
      }
      return { success: true };
    } catch (e: any) {
      if (e.message?.includes('UNIQUE constraint failed: users.username')) {
        return { success: false, error: 'Username already exists.' };
      }
      console.error(e);
      return { success: false, error: 'Failed to save user.' };
    }
  },
  zod$({
    id: z.coerce.number().optional(),
    username: z.string().min(3, 'Username must be at least 3 characters.'),
    name: z.string().min(2, 'Name is required.'),
    role: z.enum(['admin', 'manager', 'viewer']),
    email: z.string().email('Invalid email address.'),
    password: z.string().min(8, 'Password must be at least 8 characters.').optional().or(z.literal('')),
  })
);

// Toggle Active Status Action
export const useToggleUserStatus = routeAction$(async ({ id, active }, requestEvent) => {
  const session = await getSession(requestEvent);
  if (!session?.is_admin) return { success: false, error: 'Unauthorized' };

  const db = tursoClient(requestEvent);
  try {
    await db.execute({
      sql: 'UPDATE users SET active = ? WHERE id = ?',
      args: [!active, String(id)]
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to update status.' };
  }
});

// Delete User Action
export const useDeleteUser = routeAction$(async ({ id }, requestEvent) => {
  const session = await getSession(requestEvent);
  if (!session?.is_admin) return { success: false, error: 'Unauthorized' };

  const db = tursoClient(requestEvent);
  try {
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [String(id)] });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to delete user.' };
  }
});

export default component$(() => {
  useAuthLoader();
  const users = useUsersLoader();
  const saveAction = useSaveUser();
  const toggleStatusAction = useToggleUserStatus();
  const deleteAction = useDeleteUser();

  const showModal = useSignal(false);
  // Use signals for each field
  const editingId = useSignal<number | undefined>(undefined);
  const editingName = useSignal('');
  const editingUsername = useSignal('');
  const editingEmail = useSignal('');
  const editingRole = useSignal<'admin' | 'manager' | 'viewer'>('viewer');
  const editingPassword = useSignal('');

  const openModal = $((user: User | null) => {
    if (user) {
      editingId.value = user.id;
      editingName.value = user.name;
      editingUsername.value = user.username;
      editingEmail.value = user.email;
      editingRole.value = user.role;
      editingPassword.value = '';
    } else {
      editingId.value = undefined;
      editingName.value = '';
      editingUsername.value = '';
      editingEmail.value = '';
      editingRole.value = 'viewer';
      editingPassword.value = '';
    }
    showModal.value = true;
  });

  const roles = [
    { value: 'admin', label: 'Administrator' },
    { value: 'manager', label: 'Manager' },
    { value: 'viewer', label: 'Viewer' }
  ];

  return (
    <main class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header class="mb-8 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-xl shadow-sm p-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center">
              <LuUsers class="h-8 w-8 text-teal-600 dark:text-teal-500 mr-3" />
              <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">User Administration</h1>
                <p class="text-slate-500 dark:text-slate-400 mt-1">Manage users and their permissions</p>
              </div>
            </div>
            <button onClick$={() => openModal(null)} class="mt-4 sm:mt-0 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200">
              <LuPlus class="mr-2 h-4 w-4" />
              Add User
            </button>
          </div>
        </header>

        {/* Users Table */}
        <div class="bg-white dark:bg-slate-800 shadow-lg rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead class="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">User</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Role</th>
                  <th class="px-6 py-4 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-4 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {users.value.map((user) => (
                  <tr key={user.id} class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 group">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm font-medium text-slate-800 dark:text-slate-100">{user.name}</div>
                      <div class="text-sm text-slate-500 dark:text-slate-400">{user.email}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{user.role}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.active ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 dark:from-emerald-900/30 dark:to-emerald-800/30 dark:text-emerald-400' : 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-600 dark:from-slate-700 dark:to-slate-600 dark:text-slate-300'}`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex justify-end space-x-2">
                        <button onClick$={() => openModal(user)} class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-full transition-all" title="Edit User">
                          <LuPencil class="h-5 w-5" />
                        </button>
                        <Form action={toggleStatusAction}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="active" value={user.active ? 'true' : 'false'} />
                          <button type="submit" class={`p-1.5 rounded-full transition-all ${user.active ? 'text-slate-600 dark:text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:text-yellow-400 dark:hover:bg-yellow-900/20' : 'text-slate-600 dark:text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-900/20'}`} title={user.active ? 'Deactivate' : 'Activate'}>
                            {user.active ? <LuShieldOff class="h-5 w-5" /> : <LuShieldCheck class="h-5 w-5" />}
                          </button>
                        </Form>
                        <Form action={deleteAction}>
                          <input type="hidden" name="id" value={user.id} />
                          <button type="submit" class="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-full transition-all" title="Delete User">
                            <LuTrash class="h-5 w-5" />
                          </button>
                        </Form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showModal.value && (
        <div class="fixed inset-0 z-50 overflow-y-auto">
          <div class="flex items-end sm:items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-slate-700/70 dark:bg-slate-900/80 backdrop-blur-md transition-opacity" aria-hidden="true" onClick$={() => showModal.value = false}></div>
            <div class="inline-block align-bottom bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl text-left overflow-hidden shadow-2xl transform transition-all border border-slate-100/50 dark:border-slate-700/50 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <Form action={saveAction} onSubmitCompleted$={() => { if (saveAction.value?.success) { showModal.value = false; } }}>
                <div class="px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 class="text-xl leading-6 font-medium text-slate-800 dark:text-slate-100">{editingId.value ? 'Edit' : 'Add'} User</h3>
                  <input type="hidden" name="id" value={editingId.value} />
                  <div class="mt-4 space-y-4">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label for="name" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                        <input type="text" name="name" id="name" bind:value={editingName} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                        {saveAction.value?.fieldErrors?.name && <p class="text-red-500 text-sm mt-1">{saveAction.value.fieldErrors.name}</p>}
                      </div>
                      <div>
                        <label for="username" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
                        <input type="text" name="username" id="username" bind:value={editingUsername} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                        {saveAction.value?.fieldErrors?.username && <p class="text-red-500 text-sm mt-1">{saveAction.value.fieldErrors.username}</p>}
                      </div>
                    </div>
                    <div>
                      <label for="email" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                      <input type="email" name="email" id="email" bind:value={editingEmail} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                      {saveAction.value?.fieldErrors?.email && <p class="text-red-500 text-sm mt-1">{saveAction.value.fieldErrors.email}</p>}
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label for="role" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                            <select name="role" id="role" bind:value={editingRole} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm">
                                {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label for="password" class="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                            <input type="password" name="password" id="password" bind:value={editingPassword} placeholder={editingId.value ? 'Leave blank to keep current' : ''} class="mt-1 block w-full border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm py-3 px-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                            {saveAction.value?.fieldErrors?.password && <p class="text-red-500 text-sm mt-1">{saveAction.value.fieldErrors.password}</p>}
                        </div>
                    </div>
                  </div>
                </div>
                <div class="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 px-6 py-4 sm:flex sm:flex-row-reverse">
                  <button type="submit" disabled={saveAction.isRunning} class="w-full inline-flex justify-center items-center rounded-lg border border-transparent shadow-sm px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-base font-medium text-white hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200 disabled:opacity-50">
                    {saveAction.isRunning ? <LuLoader2 class="animate-spin h-5 w-5 mr-2" /> : <LuSave class="h-5 w-5 mr-2" />}
                    Save User
                  </button>
                  <button type="button" onClick$={() => showModal.value = false} class="mt-3 w-full inline-flex justify-center items-center rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm px-5 py-2.5 bg-white dark:bg-slate-800 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all duration-200">
                    <LuX class="h-5 w-5 mr-2" />
                    Cancel
                  </button>
                </div>
                {saveAction.value?.success === false && (
                  <div class="p-4 bg-red-100 text-red-800 rounded-b-lg">
                    <LuAlertTriangle class="inline h-5 w-5 mr-2" />
                    {saveAction.value.error}
                  </div>
                )}
              </Form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
});
