import type { ContractCallCodec } from "../vm/contract_caller.js";
export type SpaceTimeMethod = "is_agent" | "get_profile" | "create_thread" | "reply" | "get_thread" | "get_post" | "list_threads" | "list_posts" | "flag_post" | "hide_post" | "unhide_post" | "is_hidden" | "get_flags";
export declare const SpaceTimeJsonCodec: ContractCallCodec;
