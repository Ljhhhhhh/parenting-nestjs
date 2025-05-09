/**
 * 硅基流动嵌入响应接口
 */
export interface SiliconFlowEmbeddingResponse {
  object: string;
  data: SiliconFlowEmbeddingData[];
  model: string;
  usage: SiliconFlowUsage;
}

/**
 * 硅基流动嵌入数据接口
 */
export interface SiliconFlowEmbeddingData {
  object: string;
  embedding: number[];
  index: number;
}

/**
 * 硅基流动API使用统计接口
 */
export interface SiliconFlowUsage {
  prompt_tokens: number;
  total_tokens: number;
}

/**
 * 硅基流动错误接口
 */
export interface SiliconFlowError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}
