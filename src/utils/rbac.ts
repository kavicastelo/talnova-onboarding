import { Role } from '../context/RoleContext';

export type Capability =
  | 'manage_organization'
  | 'manage_employees'
  | 'view_directory'
  | 'create_journey'
  | 'create_course'
  | 'create_task_template'
  | 'assign_task'
  | 'create_milestone'
  | 'assign_milestone'
  | 'view_team_ops'
  | 'view_hr_ops'
  | 'manage_workflows'
  | 'manage_integrations'
  | 'manage_sso'
  | 'manage_it_ops'
  | 'ai_course_builder'
  | 'view_analytics'
  | 'view_super_admin';

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  super_admin: [
    'manage_organization',
    'manage_employees',
    'view_directory',
    'create_journey',
    'create_course',
    'create_task_template',
    'assign_task',
    'create_milestone',
    'assign_milestone',
    'view_team_ops',
    'view_hr_ops',
    'manage_workflows',
    'manage_integrations',
    'manage_sso',
    'manage_it_ops',
    'ai_course_builder',
    'view_analytics',
    'view_super_admin',
  ],
  admin: [
    'manage_organization',
    'manage_employees',
    'view_directory',
    'create_journey',
    'create_course',
    'create_task_template',
    'assign_task',
    'create_milestone',
    'assign_milestone',
    'view_team_ops',
    'view_hr_ops',
    'manage_workflows',
    'manage_integrations',
    'manage_sso',
    'manage_it_ops',
    'ai_course_builder',
    'view_analytics',
  ],
  owner: [
    'manage_organization',
    'manage_employees',
    'view_directory',
    'create_journey',
    'create_course',
    'create_task_template',
    'assign_task',
    'create_milestone',
    'assign_milestone',
    'view_team_ops',
    'view_hr_ops',
    'manage_workflows',
    'manage_integrations',
    'manage_sso',
    'manage_it_ops',
    'ai_course_builder',
    'view_analytics',
  ],
  it_admin: [
    'view_directory',
    'assign_task',
    'manage_it_ops',
    'manage_integrations',
  ],
  hr_admin: [
    'manage_employees',
    'view_directory',
    'create_journey',
    'create_course',
    'create_task_template',
    'assign_task',
    'create_milestone',
    'assign_milestone',
    'view_team_ops',
    'view_hr_ops',
    'manage_workflows',
    'manage_integrations',
    'ai_course_builder',
    'view_analytics',
  ],
  manager: [
    'view_directory',
    'create_task_template',
    'assign_task',
    'create_milestone',
    'assign_milestone',
    'view_team_ops',
    'view_analytics',
  ],
  employee: [],
};

export function hasCapability(roleOrRoles: Role | Role[] | string | string[], capability: Capability): boolean {
  if (!roleOrRoles) return false;
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  return roles.some((r) => {
    const capabilities = ROLE_CAPABILITIES[r as Role] || [];
    return capabilities.includes(capability);
  });
}
