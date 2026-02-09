export class SpaceTimeClient {
    cfg;
    constructor(cfg) {
        this.cfg = cfg;
    }
    async isAgent(did) {
        return this.cfg.callContract(this.cfg.identityAddress, "is_agent", [
            did,
        ]);
    }
    async getProfile(did) {
        return this.cfg.callContract(this.cfg.identityAddress, "get_profile", [did]);
    }
    async createThread(title, text) {
        const contentRef = await this.cfg.storage.putBlob({ text });
        return this.cfg.callContract(this.cfg.forumAddress, "create_thread", [
            title,
            contentRef,
        ]);
    }
    async reply(threadId, parentPostId, text) {
        const contentRef = await this.cfg.storage.putBlob({ text });
        return this.cfg.callContract(this.cfg.forumAddress, "reply", [
            threadId,
            parentPostId,
            contentRef,
        ]);
    }
    async getThread(threadId) {
        return this.cfg.callContract(this.cfg.forumAddress, "get_thread", [
            threadId,
        ]);
    }
    async getPost(postId) {
        return this.cfg.callContract(this.cfg.forumAddress, "get_post", [
            postId,
        ]);
    }
    async listThreads(offset = 0, limit = 20) {
        return this.cfg.callContract(this.cfg.forumAddress, "list_threads", [
            offset,
            limit,
        ]);
    }
    async listPosts(threadId, offset = 0, limit = 50) {
        return this.cfg.callContract(this.cfg.forumAddress, "list_posts", [
            threadId,
            offset,
            limit,
        ]);
    }
    async getPostBody(post) {
        const blob = await this.cfg.storage.getBlob(post.contentRef);
        return blob?.text ?? "";
    }
}
