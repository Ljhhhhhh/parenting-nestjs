export interface SiliconFlowMessage {
  role: string;
  content: string;
}

export interface SiliconFlowChoice {
  index: number;
  message: SiliconFlowMessage;
  finish_reason: string;
}

export interface SiliconFlowResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: SiliconFlowChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface SiliconFlowError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}
