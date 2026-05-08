declare module 'react-native-get-sms-android' {
  export interface SmsFilter {
    box?: 'inbox' | 'sent' | 'draft' | 'outbox' | 'failed' | 'queued';
    minDate?: number;
    maxDate?: number;
    bodyRegex?: string;
    indexFrom?: number;
    maxCount?: number;
    address?: string;
    read?: 0 | 1;
  }

  export interface SmsMessage {
    _id: string;
    address: string;
    body: string;
    date: number;
    date_sent: number;
    read: number;
    status: number;
    type: number;
    service_center: string | null;
    thread_id: string;
  }

  const SmsAndroid: {
    list(
      filter: string,
      fail: (error: string) => void,
      success: (count: number, smsList: string) => void
    ): void;
  };

  export default SmsAndroid;
}
