import { Role } from '../context/RoleContext';

export type Capability =
  | 'manage_organization'
  | 'manage_employees'
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
  | 'ai_course_builder'
  | 'view_analytics'
  | 'view_super_admin';

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  super_admin: [
    'manage_organization',
    'manage_employees',
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
    'ai_course_builder',
    'view_analytics',
    'view_super_admin',
  ],
  admin: [
    'manage_organization',
    'manage_employees',
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
    'ai_course_builder',
    'view_analytics',
  ],
  owner: [
    'manage_organization',
    'manage_employees',
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
    'ai_course_builder',
    'view_analytics',
  ],
  hr_admin: [
    'manage_employees',
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
    'create_task_template',
    'assign_task',
    'create_milestone',
    'assign_milestone',
    'view_team_ops',
    'view_analytics',
  ],
  employee: [],
};

export function hasCapability(role: Role, capability: Capability): boolean {
  if (!role) return false;
  const capabilities = ROLE_CAPABILITIES[role] || [];
  return capabilities.includes(capability);
}
