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
