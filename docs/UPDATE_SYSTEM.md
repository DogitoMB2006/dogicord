# Sistema de Detección de Actualizaciones

## Descripción General

El sistema de detección de actualizaciones de Dogicord permite notificar automáticamente a los usuarios cuando hay una nueva versión disponible, sin requerir actualización manual de la página.

## Componentes del Sistema

### 1. **UpdateService** (`src/services/updateService.ts`)
- **Función**: Servicio singleton que maneja la detección de actualizaciones
- **Características**:
  - Verifica actualizaciones cada 5 minutos
  - Usa múltiples métodos de detección de versión
  - Sistema de suscripciones para notificar cambios
  - Cache-busting para evitar versiones cacheadas

### 2. **UpdateModal** (`src/components/ui/UpdateModal.tsx`)
- **Función**: Modal elegante y responsive para mostrar notificaciones de actualización
- **Características**:
  - Diseño moderno con gradientes y animaciones
  - Información detallada de versiones (actual vs nueva)
  - Botones para actualizar ahora o recordar más tarde
  - Completamente responsive (móvil y desktop)

### 3. **useAppUpdate** (`src/hooks/useAppUpdate.ts`)
- **Función**: Hook personalizado de React para integrar el sistema de actualizaciones
- **Características**:
  - Estado reactivo de actualizaciones
  - Funciones para aplicar o descartar actualizaciones
  - Gestión automática de suscripciones

## Métodos de Detección de Versión

El sistema utiliza múltiples estrategias para detectar versiones:

1. **version.json** (principal)
   - Archivo generado automáticamente en build
   - Contiene timestamp, versión, información de Git, etc.

2. **package.json** (fallback)
   - Usa la versión del package.json si version.json no está disponible

3. **Meta tags HTML** (fallback)
   - Lee meta tags `build-time` y `app-version` del HTML

4. **Timestamp dinámico** (desarrollo)
   - Para entornos de desarrollo, usa timestamps únicos

## Flujo de Funcionamiento

### Al Inicializar la App:
1. `UpdateService` se inicializa automáticamente
2. Obtiene la versión actual usando los métodos de detección
3. Inicia verificaciones periódicas cada 5 minutos
4. Verifica inmediatamente si hay actualizaciones

### Al Detectar Actualización:
1. Compara versión actual vs versión del servidor
2. Si son diferentes, marca como "actualización disponible"
3. Notifica a todos los suscriptores (componentes React)
4. `UpdateModal` se muestra automáticamente

### Al Aplicar Actualización:
1. Usuario hace clic en "Actualizar Ahora"
2. Se muestra estado de carga
3. Se ejecuta `window.location.reload()` para recargar la página
4. La nueva versión se carga automáticamente

## Configuración para Vercel

### Script de Build (`scripts/generate-version.js`):
- Se ejecuta automáticamente antes del build (`prebuild`)
- Genera `public/version.json` con información de la versión
- Actualiza meta tags en `index.html`
- Usa variables de entorno de Vercel para información de Git

### Variables de Entorno Utilizadas:
- `VERCEL_GIT_COMMIT_SHA`: Hash del commit actual
- `VERCEL_GIT_COMMIT_REF`: Branch actual
- `VERCEL_URL`: URL del deployment
- `NODE_ENV`: Entorno (production/development)

## Archivos Generados

### `public/version.json`:
```json
{
  "version": "1.0.0",
  "timestamp": "1703875200000",
  "buildDate": "2023-12-29T12:00:00.000Z",
  "gitCommit": "abc123def456",
  "gitBranch": "main",
  "environment": "production",
  "deploymentUrl": "dogicord.vercel.app",
  "description": "Build 1703875200000 - 2023-12-29T12:00:00.000Z"
}
```

### Meta tags en `index.html`:
```html
<meta name="build-time" content="1703875200000" />
<meta name="app-version" content="1.0.0" />
```

## Uso en Componentes

```tsx
import { useAppUpdate } from '../hooks/useAppUpdate'

function MyComponent() {
  const { 
    hasUpdate, 
    currentVersion, 
    latestVersion, 
    isModalOpen, 
    applyUpdate, 
    dismissUpdate 
  } = useAppUpdate()
  
  return (
    <div>
      {hasUpdate && <div>Nueva versión disponible!</div>}
      <UpdateModal
        isOpen={isModalOpen}
        onUpdate={applyUpdate}
        onDismiss={dismissUpdate}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
      />
    </div>
  )
}
```

## Comandos Disponibles

```bash
# Generar información de versión manualmente
npm run version:generate

# Build con generación automática de versión
npm run build

# Desarrollo (no requiere generación de versión)
npm run dev
```

## Beneficios

1. **Experiencia de Usuario Mejorada**: Los usuarios son notificados automáticamente de actualizaciones
2. **No Interrupciones**: Las actualizaciones se aplican solo cuando el usuario decide
3. **Información Transparente**: Se muestra claramente qué versiones están involucradas
4. **Detección Robusta**: Múltiples métodos de detección garantizan confiabilidad
5. **Integración con CI/CD**: Funciona perfectamente con Vercel y otros servicios

## Consideraciones de Rendimiento

- **Verificaciones Ligeras**: Solo fetch pequeños archivos JSON
- **Cache-Busting Inteligente**: Evita caches obsoletos sin sobrecargar
- **Intervalos Razonables**: 5 minutos entre verificaciones
- **Cleanup Automático**: Limpieza de listeners para evitar memory leaks

Este sistema proporciona una experiencia moderna y profesional para mantener la aplicación actualizada sin interrumpir el flujo de trabajo del usuario.
