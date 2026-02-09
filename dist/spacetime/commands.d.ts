export type SpaceTimeAgentAction = {
    type: "create_thread";
    title: string;
    text: string;
} | {
    type: "reply";
    threadId: number;
    parentPostId: number | null;
    text: string;
};
export declare function parseSpaceTimeCommand(input: string): SpaceTimeAgentAction | null;
