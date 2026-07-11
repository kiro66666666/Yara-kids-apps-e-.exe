# YARA Kids Native Launcher Manual

## 1. Objetivo

Este documento organiza a arquitetura atual dos apps nativos e esclarece como eles devem se relacionar com o site.

## 2. Componentes

## 2.1 Windows

- Stack: Electron + NSIS
- Artefato publico: `YARA-Kids-Setup.exe`
- Manifesto publico: `YARA-Kids.windows.manifest.json`
- Papel:
  - instalar o app Windows
  - abrir o launcher visual
  - consultar configuracao publica do site
  - checar updates
  - baixar e instalar update sem navegador

## 2.2 Android

- Stack: Capacitor
- Artefato publico: `YARA-Kids.apk`
- Papel:
  - wrapper leve do site online
  - build com icone alinhado ao branding do site

## 3. O que o setup Windows e o que ele nao e

## 3.1 O que ele e

- um instalador nativo leve
- responsavel por instalar a versao atual
- responsavel por permitir atualizacao futura

## 3.2 O que ele nao e

- nao e um mini site
- nao e uma tela HTML completa de marketing
- nao e a camada principal de branding dinamico

Decisao arquitetural:
- o setup deve permanecer simples
- a experiencia rica deve viver no launcher

## 4. Fluxo correto de integracao com o site

1. O admin do site define branding e midia do launcher.
2. O site publica isso no endpoint `launcher-config`.
3. O launcher consulta:
   - `launcher-config`
   - `YARA-Kids.windows.manifest.json`
4. O launcher decide:
   - abrir o app atual
   - avisar update
   - baixar o instalador mais novo

## 5. Fluxo de release

## 5.1 Publicacao

O workflow de release dos apps e disparado por:
- tag `release-windows-*`

O pipeline publica:
- `YARA-Kids-Setup.exe`
- `YARA-Kids.windows.manifest.json`
- `YARA-Kids.apk`

## 5.2 Links estaveis

Os links do site devem permanecer:

- Windows:
  - `https://github.com/kiro66666666/Yara-kids-apps-e-.exe/releases/latest/download/YARA-Kids-Setup.exe`
- Manifesto:
  - `https://github.com/kiro66666666/Yara-kids-apps-e-.exe/releases/latest/download/YARA-Kids.windows.manifest.json`
- Android:
  - `https://github.com/kiro66666666/Yara-kids-apps-e-.exe/releases/latest/download/YARA-Kids.apk`

Esses links nao devem ser trocados a cada versao.

## 6. Fontes de verdade do launcher

| Tema | Fonte |
| --- | --- |
| Branding visual | endpoint `launcher-config` |
| Midia imagem/video | `launcher_media` no Supabase |
| Versao remota | manifesto Windows |
| Instalador atual | GitHub Release latest |

## 7. Limites atuais

### 7.1 SmartScreen

Sem certificado de assinatura:
- o Windows pode mostrar `Fornecedor desconhecido`
- isso nao se resolve apenas com codigo

### 7.2 UX do setup

Mesmo com artes melhores, o setup continua sendo nativo.
Se a equipe quiser uma experiencia visual ainda mais sofisticada:
- isso deve acontecer no launcher
- nao no instalador NSIS tradicional

## 8. Checklist operacional

Antes de publicar uma release Windows:

- confirmar build local
- confirmar manifesto
- confirmar checksum
- confirmar launcher-config consistente
- confirmar links `latest/download`

Depois de publicar:

- validar `releases/latest/download/YARA-Kids-Setup.exe`
- validar `releases/latest/download/YARA-Kids.windows.manifest.json`
- validar abertura do app
- validar update silencioso

## 9. Recomendacoes

### Curto prazo

- manter esta arquitetura de `setup minimo + launcher dinamico`
- evitar empurrar logica de site para dentro do NSIS

### Medio prazo

- assinar o `.exe`
- melhorar observabilidade do launcher e do fluxo de update

### Longo prazo

- expandir o contrato do endpoint para outros apps nativos se necessario

## 10. Resumo executivo

O ecossistema nativo da YARA Kids esta corretamente desenhado para:
- manter links estaveis
- atualizar por manifesto
- consumir branding do site
- separar a UX rica do launcher da UX nativa do instalador

Essa separacao e a base profissional recomendada para o projeto.
