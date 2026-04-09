/** Allowed values for `projects.status` (matches DB CHECK). */
export type ProjectStatus = 'proposal' | 'planned' | 'in_progress' | 'completed';

/** Fixed project type categories (stored in `projects.project_type`). */
export const PROJECT_CATEGORY_VALUES = [
  'consultancy',
  'team_coaching',
  'coaching',
  'recruitment',
  'assessment',
  'training',
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORY_VALUES)[number];

export function projectCategoryLabel(value: string): string {
  const labels: Record<ProjectCategory, string> = {
    consultancy: 'Consultancy',
    team_coaching: 'Team coaching',
    coaching: 'Coaching',
    recruitment: 'Recruitment',
    assessment: 'Assessment',
    training: 'Training',
  };
  return labels[value as ProjectCategory] ?? value;
}

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          company_name: string | null;
          cif: string | null;
          street: string | null;
          postal_code: string | null;
          city: string | null;
          province: string | null;
          comments: string | null;
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          company_name?: string | null;
          cif?: string | null;
          street?: string | null;
          postal_code?: string | null;
          city?: string | null;
          province?: string | null;
          comments?: string | null;
          source?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          company_name?: string | null;
          cif?: string | null;
          street?: string | null;
          postal_code?: string | null;
          city?: string | null;
          province?: string | null;
          comments?: string | null;
          source?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          user_id: string;
          client_id: string | null;
          name: string;
          company: string | null;
          email: string | null;
          personal_phone: string | null;
          work_phone: string | null;
          position: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id?: string | null;
          name: string;
          company?: string | null;
          email?: string | null;
          personal_phone?: string | null;
          work_phone?: string | null;
          position?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string | null;
          name?: string;
          company?: string | null;
          email?: string | null;
          personal_phone?: string | null;
          work_phone?: string | null;
          position?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contacts_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          reference: string;
          project_name: string;
          project_type: string | null;
          status: ProjectStatus;
          start_date: string | null;
          end_date: string | null;
          budget: number;
          paid: number;
          invoiced: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          reference: string;
          project_name?: string;
          project_type?: string | null;
          status?: ProjectStatus;
          start_date?: string | null;
          end_date?: string | null;
          budget?: number;
          paid?: number;
          invoiced?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_id?: string;
          reference?: string;
          project_name?: string;
          project_type?: string | null;
          status?: ProjectStatus;
          start_date?: string | null;
          end_date?: string | null;
          budget?: number;
          paid?: number;
          invoiced?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database['public']['Tables'];

export type TablesRow<T extends TableName> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends TableName> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends TableName> = Database['public']['Tables'][T]['Update'];

/** Convenience aliases */
export type Client = TablesRow<'clients'>;
export type Contact = TablesRow<'contacts'>;
export type Project = TablesRow<'projects'>;

/** Nested client from `select('*, clients(...)')` on contacts / projects. */
export type ClientNameNested = Pick<Client, 'name'>;

export type ContactWithClient = Contact & {
  clients: ClientNameNested | null;
};

export type ProjectWithClient = Project & {
  clients: ClientNameNested | null;
};
