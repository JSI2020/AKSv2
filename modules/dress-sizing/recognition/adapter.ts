export type VisionAdapter = {
  complete(imageUrl: string, prompt: string): Promise<string>;
};

export const GARMENT_RECOGNITION_PROMPT = `Inspect this Pakistani womenswear garment and return JSON only:
{"templateKey":"short_shirt|long_gown|kurti|vest_palazzo|trouser","lengthBand":"above_knee|knee|below_knee|ankle|floor","fitIntent":"fitted|semi_fitted|relaxed|oversized","confidence":0.0,"points":{"hem":{"landmark":"hip|mid_thigh|above_knee|knee|mid_calf|ankle|floor","fullness":"slim|regular|flared"},"neck":{"shape":"high|round|boat|v|keyhole|deep_v","drop":"shallow|regular|deep"},"sleeve":{"style":"sleeveless|cap|short|elbow|three_quarter|full"},"chest":{"fit":"fitted|semi_fitted|relaxed|oversized"},"waist":{"fit":"fitted|semi_fitted|relaxed|oversized"},"hip":{"fit":"fitted|semi_fitted|relaxed|oversized"},"shoulder":{"width":"narrow|regular|wide"}}}
Do not infer absolute measurements.`;
