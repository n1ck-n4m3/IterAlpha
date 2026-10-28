declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    DECISION_API_URL?: string;
    DECISION_API_KEY?: string;
    DECISION_MODEL?: string;
    DECISION_MODEL_REVISION?: string;
    COINBASE_MARKET_DATA_LICENSED?: string;
    SPIDER_RUNNER_KEY?: string;
  }
}
