/**
 * Name de-identification utilities for PHI privacy
 *
 * Since ZenLeef is not HIPAA-compliant, we automatically abbreviate
 * last names to prevent identifiable PHI when combined with ICD codes.
 */

/**
 * De-identifies a name by abbreviating the last name
 *
 * @example
 * deidentifyName("Paulo Dichone") → "Paulo D."
 * deidentifyName("Mary Jane Watson") → "Mary Jane W."
 * deidentifyName("John") → "John" (single name kept as-is)
 * deidentifyName("Sarah J.") → "Sarah J." (already abbreviated)
 * deidentifyName("") → "" (empty kept)
 */
export function deidentifyName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '';

  // Check if already abbreviated (ends with single letter + period)
  if (/\s[A-Za-z]\.$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    // Single name - keep as-is (might already be an alias)
    return trimmed;
  }

  // Take first part(s) except last + abbreviated last
  const firstName = parts.slice(0, -1).join(' ');
  const lastName = parts[parts.length - 1];

  return `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
}

/**
 * Check if a name appears to be already de-identified
 * (ends with a single letter followed by a period)
 */
export function isDeidentified(name: string): boolean {
  return /\s[A-Za-z]\.$/.test(name.trim());
}
