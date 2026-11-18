export type Phase = "lobby" | "choosing" | "question" | "reveal" | "scoring" | "game_over";
export type QuestionMode = "deck" | "players";

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  is_host: boolean;
  has_answered: boolean;
}

export interface GroupAnswer {
  player_id: string;
  name: string;
  text: string;
}

export interface GroupView {
  key: string;
  label: string;
  player_ids: string[];
  answers: GroupAnswer[];
}

export interface RoundResultView {
  herd_group_key: string | null;
  point_deltas: Record<string, number>;
  previous_cow_holder: string | null;
  new_cow_holder: string | null;
  cow_moved: boolean;
  /** absent on rounds scored before these rules existed */
  cow_round?: boolean;
  sour_milk_player_id?: string | null;
  /** points actually lost to sour milk (0 when already on zero) */
  sour_milk_lost?: number;
}

export interface RecapRoundView {
  number: number;
  question: string;
  /** null when the biggest groups tied (no herd) */
  herd_label: string | null;
  herd_player_ids: string[];
  /** the tied biggest groups' labels, when there was no herd */
  tied_labels: string[];
  cow_holder_after: string | null;
  cow_round?: boolean;
  /** cow rounds: the lone answers that scored */
  solo?: { label: string; player_id: string }[];
}

export interface RecapAward {
  id: "loyal_sheep" | "lone_wolf" | "cow_keeper";
  /** everyone tied for the award */
  player_ids: string[];
  value: number;
}

export interface GameRecap {
  rounds: RecapRoundView[];
  awards: RecapAward[];
}

export interface GameState {
  code: string;
  phase: Phase;
  players: PlayerView[];
  host_player_id: string | null;
  pink_cow_player_id: string | null;
  win_target: number;
  cow_rounds: "off" | "every4" | "random";
  sour_milk: boolean;
  /** this round is a Cow Round: lone answers score, the herd doesn't */
  cow_round: boolean;
  /** seconds to answer; 0 = no timer */
  timer_seconds: number;
  /** ISO UTC; set while answering in a timed room */
  deadline: string | null;
  /** ISO UTC server clock when this snapshot was built (clock-skew correction) */
  server_now: string;
  /** everyone answered: answers stay editable until `deadline` ("última chance") */
  closing: boolean;
  /** ISO UTC; the staged reveal animation is timed from this */
  revealed_at: string | null;
  /** selected deck categories; empty = all */
  categories: string[];
  categories_available: { id: string; count: number }[];
  /** sudden death: 2+ eligible players tied at/above the target */
  tied_player_ids: string[];
  round_number: number;
  question: string | null;
  question_mode: QuestionMode;
  /** players mode: whose turn it is (or was) to pick the question */
  chooser_player_id: string | null;
  /** who wrote or drew this round's question (players mode) */
  question_author_id: string | null;
  question_is_custom: boolean;
  answered_player_ids: string[];
  groups: GroupView[];
  result: RoundResultView | null;
  winner_player_id: string | null;
  /** game_over only */
  recap: GameRecap | null;
}

export type ServerMessage =
  | { type: "state"; state: GameState }
  | { type: "error"; message: string };

export interface Session {
  code: string;
  playerId: string;
  name: string;
}
