import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface InnovatorMetadata {
  bioText: string;
  category?: "student" | "self_finance" | "organization" | null;
  institution_name?: string;
  institution_website?: string;
  portfolio?: string;
  years_of_experience?: string;
  domain_interests?: string;
  organization_gst?: string;
  profile_image?: string;
}

export function parseProfileMetadata(bioString: string | null | undefined): InnovatorMetadata {
  if (!bioString) return { bioText: "" };
  try {
    const data = JSON.parse(bioString);
    if (typeof data === "object" && data !== null) {
      return {
        bioText: data.bioText || "",
        category: data.category || null,
        institution_name: data.institution_name || "",
        institution_website: data.institution_website || "",
        portfolio: data.portfolio || "",
        years_of_experience: data.years_of_experience || "",
        domain_interests: data.domain_interests || "",
        organization_gst: data.organization_gst || "",
        profile_image: data.profile_image || ""
      };
    }
  } catch (e) {
    // Legacy bio string
    return { bioText: bioString };
  }
  return { bioText: bioString };
}

export function stringifyProfileMetadata(metadata: InnovatorMetadata): string {
  return JSON.stringify(metadata);
}

export interface ProjectMetadata {
  descriptionText: string;
  closing_time?: string; // ISO date string
  distance_limit?: string; 
  domain?: string; // e.g. "Health", "Agri", "Finance"
  budget?: string; // e.g. "Unpaid", "Paid", "Equity"
  project_phase?: string; // e.g. "Idea", "Prototype", "Production"
}

export function parseProjectMetadata(descString: string | null | undefined): ProjectMetadata {
  if (!descString) return { descriptionText: "" };
  try {
    const data = JSON.parse(descString);
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return {
        descriptionText: data.descriptionText || "",
        closing_time: data.closing_time || "",
        distance_limit: data.distance_limit || "",
        domain: data.domain || data.duration || "", // fallback to duration for legacy
        budget: data.budget || "",
        project_phase: data.project_phase || ""
      };
    }
  } catch (e) {
    // Legacy description string
    return { descriptionText: descString };
  }
  return { descriptionText: descString };
}

export function stringifyProjectMetadata(metadata: ProjectMetadata): string {
  return JSON.stringify(metadata);
}

