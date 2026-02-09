import type { AgentProfile, Did, Post, SpaceTimeConfig, Thread } from "./types.js";
export declare class SpaceTimeClient {
    private cfg;
    constructor(cfg: SpaceTimeConfig);
    isAgent(did: Did): Promise<boolean>;
    getProfile(did: Did): Promise<AgentProfile | null>;
    createThread(title: string, text: string): Promise<number>;
    reply(threadId: number, parentPostId: number | null, text: string): Promise<number>;
    getThread(threadId: number): Promise<Thread | null>;
    getPost(postId: number): Promise<Post | null>;
    listThreads(offset?: number, limit?: number): Promise<Thread[]>;
    listPosts(threadId: number, offset?: number, limit?: number): Promise<Post[]>;
    getPostBody(post: Post): Promise<string>;
}
