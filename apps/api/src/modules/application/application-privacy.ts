// Live candidate data is available only while an application is unresolved.
// Historical application/timeline access does not authorize current CV/profile
// access. No application-time resume/profile snapshot is stored in this MVP.
export function canReadCurrentCandidateData(status: string): boolean {
    return ['applied', 'under_review', 'shortlisted', 'interview', 'final_review', 'offer'].includes(status);
}
