export interface Therapist {
  id: string;
  name: string | null;
  business_name: string | null;
  created_at: string;
}

export interface ReferringProvider {
  id: string;
  therapist_id: string;
  name: string;
  practice_name: string | null;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  fax: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  therapist_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  referring_provider_id: string | null;
  created_at: string;
  // Joined data
  referring_provider?: Pick<ReferringProvider, 'id' | 'name' | 'specialty'> | null;
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface Session {
  id: string;
  client_id: string;
  therapist_id: string;
  audio_url: string | null;
  transcript: string | null;
  soap_note: SOAPNote | null;
  raw_soap_text: string | null;
  session_date: string;
  created_at: string;
  // Joined data
  client?: Client;
}

export interface Referral {
  id: string;
  client_id: string;
  therapist_id: string;
  referring_provider_id: string | null;
  provider_name: string;
  referral_date: string;
  diagnosis: string | null;
  icd_code: string | null;
  visits_authorized: number | null;
  expiration_date: string | null;
  document_url: string | null;
  document_name: string | null;
  notes: string | null;
  created_at: string;
  // Joined data
  referring_provider?: Pick<ReferringProvider, 'id' | 'name' | 'specialty'> | null;
}

export interface Database {
  public: {
    Tables: {
      therapists: {
        Row: Therapist;
        Insert: Omit<Therapist, 'created_at'>;
        Update: Partial<Omit<Therapist, 'id' | 'created_at'>>;
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, 'id' | 'created_at'>;
        Update: Partial<Omit<Client, 'id' | 'created_at' | 'therapist_id'>>;
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'id' | 'created_at' | 'client'>;
        Update: Partial<Omit<Session, 'id' | 'created_at' | 'therapist_id' | 'client_id' | 'client'>>;
      };
    };
  };
}
