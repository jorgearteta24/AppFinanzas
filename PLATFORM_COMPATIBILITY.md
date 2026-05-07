# Compatibilidad de Plataformas

Este documento detalla qué funcionalidades están disponibles en cada plataforma.

## ✅ Funcionalidades Disponibles en Todas las Plataformas (Web, iOS, Android)

### Autenticación
- ✅ Registro de usuarios con email/contraseña
- ✅ Inicio de sesión
- ✅ Cierre de sesión
- ✅ Gestión de sesión persistente

### Cuentas
- ✅ Crear cuentas bancarias, efectivo, tarjetas de crédito
- ✅ Editar cuentas existentes
- ✅ Eliminar cuentas
- ✅ Ver saldo total de todas las cuentas
- ✅ Gestión completa de cuentas

### Categorías
- ✅ Ver categorías por defecto del sistema
- ✅ Crear categorías personalizadas
- ✅ Editar y eliminar categorías propias
- ✅ Organización de gastos e ingresos

### Transacciones Manuales
- ✅ Crear transacciones manualmente
- ✅ Editar transacciones existentes
- ✅ Eliminar transacciones
- ✅ Filtrar transacciones por fecha, tipo, cuenta
- ✅ Ver historial completo de transacciones
- ✅ Búsqueda de transacciones

### Dashboard
- ✅ Resumen de saldos totales
- ✅ Visualización de gastos vs ingresos
- ✅ Gráficos de distribución por categoría
- ✅ Transacciones recientes
- ✅ Indicadores clave

### Presupuestos
- ✅ Crear presupuestos mensuales por categoría
- ✅ Seguimiento de progreso de presupuestos
- ✅ Alertas visuales de sobregiro
- ✅ Editar y eliminar presupuestos

### Metas de Ahorro
- ✅ Crear metas de ahorro con objetivo y fecha
- ✅ Registrar aportes a metas
- ✅ Seguimiento de progreso
- ✅ Visualización de porcentaje completado

### Reportes
- ✅ Reportes de gastos por período
- ✅ Reportes por categoría
- ✅ Exportación de datos
- ✅ Gráficos comparativos

### Reglas de Clasificación Automática
- ✅ Crear reglas basadas en palabras clave
- ✅ Asignación automática de categorías
- ✅ Priorización de reglas
- ✅ Gestión de reglas personalizadas

### Conciliación de Duplicados
- ✅ Detección automática de duplicados
- ✅ Revisión manual de coincidencias
- ✅ Resolución (fusionar, mantener ambos, eliminar)
- ✅ Historial de conciliaciones

### Configuración
- ✅ Gestión de perfil de usuario
- ✅ Configuración de moneda (COP)
- ✅ Formato de fecha
- ✅ Zona horaria
- ✅ Visualización de información del sistema

## 📱 Funcionalidades Solo en Android

### Detección Automática de Notificaciones
- ✅ Lectura de notificaciones bancarias en tiempo real
- ✅ Parsing automático de montos y descripciones
- ✅ Bandeja de revisión de notificaciones detectadas
- ✅ Conversión a transacciones después de revisión manual
- ✅ Identificación de bancos colombianos (Bancolombia, Nequi, BBVA, etc.)

**Nota:** Esta función requiere:
- Permiso de acceso a notificaciones del sistema
- NotificationListenerService nativo (implementado en código nativo)
- Solo funciona en dispositivos Android reales (no en emulador web)

## 🌐 Funcionalidades Mejoradas para Web

### Tablas de Datos
- ✅ Tablas responsivas con scroll horizontal
- ✅ Ordenamiento por columnas
- ✅ Mejor visualización en pantallas grandes
- ✅ Filas alternadas para mejor legibilidad

### Navegación
- ✅ Layout optimizado para escritorio
- ✅ Uso eficiente del espacio en pantalla
- ✅ Filtros persistentes

## 🔄 Funcionalidades con Procesamiento Manual Alternativo

### Procesamiento Manual de Mensajes (Todas las plataformas)
- ✅ Pegar manualmente mensajes bancarios
- ✅ Parsing inteligente de texto
- ✅ Extracción de monto, descripción, referencia
- ✅ Sugerencias automáticas de tipo y categoría
- ✅ Edición antes de confirmar
- ✅ Creación de transacción

**Recomendado para iOS:** Esta es la forma principal de capturar transacciones desde mensajes bancarios en iOS.

### Importación desde Archivos
- ✅ Web: Subir archivos Excel/CSV directamente
- ✅ iOS: Usar selector de archivos nativo (si el dispositivo lo permite)
- ✅ Android: Usar selector de archivos nativo
- ✅ Parsing de formatos Bancolombia
- ✅ Revisión y confirmación antes de guardar

## ❌ Limitaciones por Plataforma

### iOS
- ❌ No puede leer notificaciones del sistema automáticamente (limitación de Apple)
- ❌ No puede acceder a mensajes SMS automáticamente (limitación de Apple)
- ✅ Alternativa: Usar procesamiento manual de mensajes (copiar/pegar)
- ✅ Alternativa: Importar desde archivos

### Web
- ❌ No puede acceder a notificaciones del sistema
- ❌ No puede acceder a SMS
- ✅ Todas las demás funciones disponibles completamente
- ✅ Experiencia optimizada para escritorio

### Emulador Web (Development)
- ❌ No funciona detección de notificaciones (requiere dispositivo Android real)
- ❌ No funciona acceso a sistema de archivos nativo
- ✅ Todas las demás funciones para desarrollo y pruebas

## 📋 Resumen de Flujos de Trabajo por Plataforma

### Flujo Android Óptimo
1. Configurar cuentas y categorías
2. Habilitar permisos de notificaciones
3. Las transacciones se detectan automáticamente
4. Revisar y confirmar desde bandeja de notificaciones
5. Transacciones se registran automáticamente

### Flujo iOS Recomendado
1. Configurar cuentas y categorías
2. Copiar mensaje bancario del SMS o email
3. Ir a Configuración → Procesar Mensaje Bancario
4. Pegar el mensaje y analizar
5. Revisar/editar y confirmar transacción

### Flujo Web Productivo
1. Configurar cuentas y categorías desde escritorio
2. Importar historial desde archivos Excel/CSV
3. Crear transacciones manuales según necesidad
4. Revisar dashboards y reportes
5. Gestionar presupuestos y metas

## 🔐 Seguridad

Todas las plataformas:
- ✅ Autenticación con Supabase Auth
- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Datos encriptados en tránsito
- ✅ Separación completa de datos por usuario
- ✅ Sin acceso a datos de otros usuarios

## 🎯 Recomendaciones de Uso

**Para usuarios de Android:**
- Aprovechar la detección automática de notificaciones
- Revisar periódicamente la bandeja de notificaciones pendientes

**Para usuarios de iOS:**
- Usar procesamiento manual de mensajes para captura rápida
- Importar archivos Excel mensualmente para sincronización masiva
- Registrar transacciones manuales importantes inmediatamente

**Para usuarios de Web:**
- Ideal para configuración inicial y gestión administrativa
- Excelente para análisis de reportes en pantalla grande
- Importación masiva de datos históricos
- Creación manual de transacciones desde escritorio
