/**
 * Intelligent Column Mapping & Fuzzy Header Detection Engine
 */

export interface CanonicalField {
  key: string;
  label: string;
  required?: boolean;
  description: string;
  aliases: string[];
}

export const CANONICAL_EMPLOYEE_FIELDS: CanonicalField[] = [
  {
    key: 'email',
    label: 'Email Address',
    required: true,
    description: 'Corporate or primary email address used for system login.',
    aliases: ['email', 'work email', 'e-mail', 'email address', 'mail', 'user email', 'primary email'],
  },
  {
    key: 'fullName',
    label: 'Full Name',
    required: false,
    description: 'Full employee name (will be split into first & last name if provided).',
    aliases: ['fullname', 'full name', 'employee name', 'name', 'staff name', 'worker', 'member name'],
  },
  {
    key: 'firstName',
    label: 'First Name',
    required: false,
    description: 'Employee given name.',
    aliases: ['firstname', 'first name', 'given name', 'first'],
  },
  {
    key: 'lastName',
    label: 'Last Name',
    required: false,
    description: 'Employee surname / family name.',
    aliases: ['lastname', 'last name', 'surname', 'family name', 'last'],
  },
  {
    key: 'department',
    label: 'Department',
    required: false,
    description: 'Organizational department or business unit (e.g., Engineering, Sales).',
    aliases: ['department', 'dept', 'division', 'team', 'business unit', 'unit', 'org unit'],
  },
  {
    key: 'jobTitle',
    label: 'Job Title / Designation',
    required: false,
    description: 'Role designation or job title.',
    aliases: ['jobtitle', 'job title', 'title', 'designation', 'position', 'role title', 'occupation'],
  },
  {
    key: 'role',
    label: 'System Access Role',
    required: false,
    description: 'Security role (employee, manager, admin, hr_admin, it_admin). Defaults to employee.',
    aliases: ['role', 'system role', 'access level', 'permission', 'privilege', 'user role'],
  },
  {
    key: 'managerEmail',
    label: 'Manager / Supervisor Email',
    required: false,
    description: 'Direct reporting manager email for automatic hierarchy linking.',
    aliases: ['manageremail', 'manager email', 'supervisor email', 'reports to', 'supervisor', 'line manager', 'manager'],
  },
  {
    key: 'managerEmployeeId',
    label: 'Manager Employee ID',
    required: false,
    description: 'Direct reporting manager employee ID badge.',
    aliases: ['manageremployeeid', 'manager id', 'supervisor id', 'reports to id'],
  },
  {
    key: 'employeeId',
    label: 'Employee ID / Staff Number',
    required: false,
    description: 'Unique corporate employee identification number or badge ID.',
    aliases: ['employeeid', 'employee id', 'staff id', 'emp id', 'badge id', 'worker id', 'staff number'],
  },
  {
    key: 'hireDate',
    label: 'Hire / Start Date',
    required: false,
    description: 'Official joining date (YYYY-MM-DD or MM/DD/YYYY).',
    aliases: ['hiredate', 'hire date', 'start date', 'joining date', 'commencement date', 'effective date'],
  },
  {
    key: 'employmentType',
    label: 'Employment Type',
    required: false,
    description: 'Contract status: full_time, part_time, contractor, or intern.',
    aliases: ['employmenttype', 'employment type', 'contract type', 'emp type', 'worker type'],
  },
  {
    key: 'location',
    label: 'Office Location / Site',
    required: false,
    description: 'Workplace city, branch, or office location (e.g., Tokyo, San Francisco).',
    aliases: ['location', 'office', 'site', 'work location', 'city', 'facility', 'branch'],
  },
  {
    key: 'phone',
    label: 'Phone Number',
    required: false,
    description: 'Contact phone or mobile number.',
    aliases: ['phone', 'telephone', 'mobile', 'cell', 'phone number', 'contact'],
  },
  {
    key: 'timezone',
    label: 'Timezone',
    required: false,
    description: 'Local working timezone (e.g. Asia/Tokyo, America/Los_Angeles).',
    aliases: ['timezone', 'time zone', 'tz'],
  },
];

export function autoDetectColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const assignedFields = new Set<string>();

  headers.forEach((header) => {
    const cleanHeader = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    // 1. Exact alias match
    let matchedField: CanonicalField | undefined = CANONICAL_EMPLOYEE_FIELDS.find((f) => {
      if (assignedFields.has(f.key)) return false;
      return f.aliases.some((alias) => {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanAlias === cleanHeader;
      });
    });

    // 2. Substring / inclusion match if exact match not found
    if (!matchedField) {
      matchedField = CANONICAL_EMPLOYEE_FIELDS.find((f) => {
        if (assignedFields.has(f.key)) return false;
        return f.aliases.some((alias) => {
          const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanHeader.includes(cleanAlias) || cleanAlias.includes(cleanHeader);
        });
      });
    }

    if (matchedField) {
      mapping[header] = matchedField.key;
      assignedFields.add(matchedField.key);
    } else {
      mapping[header] = '__ignore__';
    }
  });

  return mapping;
}
