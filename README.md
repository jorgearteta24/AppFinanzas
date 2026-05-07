# Aplicación de Gestión de Finanzas Personales

Una aplicación multiplataforma para controlar y analizar tus finanzas personales. Disponible en Android, iOS y Web.

## Características Principales

✅ **Gestión de Cuentas**
- Registra cuentas bancarias, tarjetas de crédito, efectivo y ahorros
- Visualiza saldo total consolidado
- Editar y eliminar cuentas

✅ **Registro de Transacciones**
- Crear transacciones manuales
- Editar y eliminar transacciones
- Filtrar por tipo, categoría, cuenta y período
- Historial completo de movimientos

✅ **Categorías Personalizadas**
- Categorías predefinidas del sistema
- Crear categorías personalizadas
- Organizar gastos e ingresos

✅ **Presupuestos Mensuales**
- Establecer límites de gasto por categoría
- Visualizar progreso en tiempo real
- Alertas visuales de sobregiro

✅ **Metas de Ahorro**
- Crear objetivos de ahorro con fecha objetivo
- Registrar aportes
- Visualizar progreso hacia la meta

✅ **Dashboard Inteligente**
- Resumen de finanzas del mes
- Gráficos de ingresos vs gastos
- Distribución de gastos por categoría
- Transacciones recientes

✅ **Reportes Detallados**
- Análisis por período (mes, trimestre, año)
- Desglose por categoría
- Exportación a PDF/Excel

✅ **Automatización**
- Reglas de clasificación automática
- Procesamiento manual de mensajes bancarios
- Detección de transacciones duplicadas

✅ **Procesamiento Manual de Mensajes**
- Pegar mensajes bancarios manualmente
- Extracción automática de datos
- Sugerencias inteligentes de categoría

## Requisitos Previos

### Para Android
- Android 6.0 o superior
- Aplicación Expo Go instalada (para desarrollo)

### Para iOS
- iOS 13 o superior
- Xcode (para desarrollo nativo)
- El procesamiento automático de notificaciones no está disponible

### Para Web
- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Conexión a internet

## Instalación y Ejecución

### Desarrollo Local

**1. Clonar el proyecto:**
```bash
git clone <repository-url>
cd project
```

**2. Instalar dependencias:**
```bash
npm install
```

**3. Configurar variables de entorno:**

Crea un archivo `.env` en la raíz del proyecto:
```
EXPO_PUBLIC_SUPABASE_URL=<tu-url-supabase>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<tu-clave-anonima>
```

**4. Ejecutar en desarrollo:**

**Android:**
```bash
npm run dev
```
Escanea el código QR con Expo Go

**iOS:**
```bash
npm run dev
```
Escanea el código QR con Expo Go

**Web:**
```bash
npm run dev
```
Accede a `http://localhost:8081` en tu navegador

### Build para Producción

**Web:**
```bash
npm run build:web
```
Los archivos compilados estarán en la carpeta `dist/`

**Android (requiere configuración de EAS):**
```bash
eas build --platform android --auto
```

**iOS (requiere configuración de EAS):**
```bash
eas build --platform ios --auto
```

## Estructura del Proyecto

```
/
├── app/                          # Rutas de Expo Router
│   ├── (auth)/                   # Rutas de autenticación
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (tabs)/                   # Pantallas principales
│       ├── index.tsx             # Dashboard
│       ├── accounts.tsx          # Cuentas
│       ├── categories.tsx        # Categorías
│       ├── transactions.tsx      # Transacciones
│       ├── budgets.tsx           # Presupuestos
│       ├── goals.tsx             # Metas de ahorro
│       ├── reports.tsx           # Reportes
│       └── settings.tsx          # Configuración
├── components/                   # Componentes reutilizables
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── DataTable.tsx
│   ├── EmptyState.tsx
│   ├── LoadingState.tsx
│   ├── ManualMessageProcessor.tsx
│   ├── RulesManager.tsx
│   └── DuplicateReconciliation.tsx
├── lib/                          # Utilidades y servicios
│   ├── supabase.ts               # Cliente de Supabase
│   ├── types.ts                  # Tipos TypeScript
│   ├── utils.ts                  # Funciones auxiliares
│   ├── rulesEngine.ts            # Motor de reglas
│   ├── notificationParser.ts     # Parser de mensajes
│   └── importUtils.ts            # Utilidades de importación
├── contexts/                     # Contextos de React
│   └── AuthContext.tsx           # Autenticación y sesión
├── constants/                    # Constantes
│   └── theme.ts                  # Colores y tipografía
└── supabase/                     # Migraciones de base de datos
    └── migrations/
```

## Configuración de la Base de Datos

La aplicación usa Supabase para almacenamiento de datos. Las migraciones se aplican automáticamente.

### Tablas principales:
- `accounts` - Cuentas bancarias del usuario
- `categories` - Categorías de gastos
- `transactions` - Transacciones registradas
- `budgets` - Presupuestos mensuales
- `savings_goals` - Metas de ahorro
- `auto_rules` - Reglas de clasificación
- `duplicate_matches` - Transacciones duplicadas detectadas
- `import_jobs` - Trabajos de importación de archivos

## Seguridad

- Autenticación con Supabase Auth (email/contraseña)
- Row Level Security (RLS) en todas las tablas
- Datos encriptados en tránsito
- Separación completa de datos por usuario
- Ningún acceso a datos ajenos

## Compatibilidad por Plataforma

### Android ✅
- Todas las funcionalidades disponibles
- Detección automática de notificaciones bancarias
- Importación desde archivos

### iOS ✅ (con limitaciones)
- Todas las funcionalidades disponibles
- Procesamiento manual de mensajes (copiar/pegar)
- Importación desde archivos
- Sin detección automática de notificaciones (limitación de Apple)

### Web ✅
- Todas las funcionalidades disponibles
- Experiencia optimizada para escritorio
- Importación desde archivos
- Sin acceso a notificaciones del sistema

Ver `PLATFORM_COMPATIBILITY.md` para detalle completo.

## Manual de Usuario

Consulta `MANUAL_DE_USUARIO.md` para instrucciones detalladas de cómo usar cada función de la aplicación.

## Troubleshooting

### Error: "No puedo conectar a la base de datos"
- Verifica que `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` estén correctos
- Revisa que Supabase esté operativo
- Intenta limpiar el caché: `npm start --clear`

### Error: "Permiso denegado"
- Verifica tu autenticación en Supabase
- Asegúrate que has iniciado sesión correctamente
- Revisa las políticas de Row Level Security

### El app se congela en Android
- Cierra otras aplicaciones
- Libera espacio en el dispositivo
- Reinicia el teléfono
- Reinstala la aplicación

### Web no carga los datos
- Limpia el caché del navegador
- Verifica la consola de desarrollador (F12)
- Revisa la conexión a internet
- Intenta en modo incógnito

## Archivos Importantes

- `package.json` - Dependencias y scripts
- `tsconfig.json` - Configuración de TypeScript
- `app.json` - Configuración de Expo
- `.env` - Variables de entorno (crear localmente)

## Scripts Disponibles

```bash
npm run dev          # Ejecutar en modo desarrollo
npm run build:web    # Compilar para web
npm run lint         # Linter del código
npm run typecheck    # Verificar tipos de TypeScript
```

## Versión

**1.0.0** - MVP completo con todas las funcionalidades principales

## Licencia

Privado - Uso exclusivo

## Soporte

Para reportar problemas o hacer preguntas:
1. Revisa el `MANUAL_DE_USUARIO.md` para preguntas comunes
2. Consulta `PLATFORM_COMPATIBILITY.md` para limitaciones por plataforma
3. Revisa la consola de desarrollador para errores técnicos

## Hoja de Ruta Futura

- Sincronización en tiempo real de múltiples dispositivos
- Categorías inteligentes con IA
- Análisis predictivo de gastos
- Recomendaciones de ahorro
- Integración con bancos (OAuth)
- Notificaciones push personalizadas
- Soporte para múltiples monedas
- Gráficos más avanzados
- Exportación a aplicaciones de contabilidad

---

**Desarrollado con Expo, React Native y Supabase**
