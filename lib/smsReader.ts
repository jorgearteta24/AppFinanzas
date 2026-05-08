import { PermissionsAndroid, Platform } from 'react-native';
import { parseNotification, isLikelyBankNotification } from './notificationParser';
import type { ParsedNotification } from './notificationParser';

export interface BankSmsMessage {
  id: string;
  sender: string;
  body: string;
  date: Date;
  parsed: ParsedNotification;
}

export async function checkSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'Permiso para leer SMS',
        message:
          'MiFinanzas necesita acceder a tus mensajes de texto para detectar ' +
          'transacciones bancarias automáticamente y registrarlas en tu cuenta.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Cancelar',
        buttonNeutral: 'Preguntar después',
      }
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function readBankSmsMessages(daysBack: number = 60): Promise<BankSmsMessage[]> {
  if (Platform.OS !== 'android') {
    throw new Error('La lectura de SMS solo está disponible en Android');
  }

  // Dynamic require to avoid crashes en web/iOS
  let SmsAndroid: any;
  try {
    const mod = require('react-native-get-sms-android');
    SmsAndroid = mod.default ?? mod; // soporta CJS y ESM
  } catch {
    throw new Error(
      'Librería de SMS no instalada. Ejecuta: npm install react-native-get-sms-android'
    );
  }

  const minDate = Date.now() - daysBack * 24 * 60 * 60 * 1000;

  return new Promise((resolve, reject) => {
    const filter = JSON.stringify({
      box: 'inbox',
      minDate,
      maxCount: 300,
    });

    SmsAndroid.list(
      filter,
      (error: string) => reject(new Error(`Error leyendo SMS: ${error}`)),
      (_count: number, smsList: string) => {
        try {
          const messages: any[] = JSON.parse(smsList);

          const bankMessages: BankSmsMessage[] = messages
            .filter(sms => {
              const sender = sms.address || '';
              const body = sms.body || '';
              return isLikelyBankNotification(sender, sender, body);
            })
            .map(sms => ({
              id: String(sms._id),
              sender: sms.address || '',
              body: sms.body || '',
              date: new Date(Number(sms.date)),
              parsed: parseNotification(sms.address || '', sms.body || ''),
            }))
            .sort((a, b) => b.date.getTime() - a.date.getTime());

          resolve(bankMessages);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}
