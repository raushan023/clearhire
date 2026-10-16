// No provider is configured in this repository. Implement this interface using
// private object storage after provider/credentials are supplied; never use a
// user-provided path or public bucket URL as an authorization mechanism.
export interface ResumeStorage {
    readonly configured: boolean;
    put(key: string, content: Buffer): Promise<void>;
    get(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
}
const unavailable = async (): Promise<never> => { throw new Error("RESUME_STORAGE_UNAVAILABLE"); };
export const resumeStorage: ResumeStorage = {
    configured: false, put: unavailable, get: unavailable, delete: unavailable,
};
