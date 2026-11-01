; Instalador do Avance para Windows (Inno Setup 6).
; Não compile direto: rode "python desktop/gerar_instalador.py", que monta o app e passa a versão.
; Caminhos relativos a esta pasta (desktop/).

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
; O AppId identifica o Avance para atualizações e desinstalação. Nunca mude.
AppId={{7829267C-708F-4DAE-B5EC-C926DC5C9ECC}
AppName=Avance
AppVersion={#AppVersion}
AppVerName=Avance {#AppVersion}
AppPublisher=Avance
AppPublisherURL=https://www.avance.dev.br
AppSupportURL=https://www.avance.dev.br
; Instala só para o usuário atual: não pede senha de administrador.
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\Avance
DisableProgramGroupPage=yes
DisableDirPage=auto
OutputDir=..\dist
OutputBaseFilename=Avance-Setup
SetupIconFile=..\web\favicon.ico
UninstallDisplayIcon={app}\Avance.exe
UninstallDisplayName=Avance
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
; Fecha o Avance aberto antes de atualizar.
CloseApplications=yes

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\dist\Avance\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{autoprograms}\Avance"; Filename: "{app}\Avance.exe"
Name: "{autodesktop}\Avance"; Filename: "{app}\Avance.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Avance.exe"; Description: "{cm:LaunchProgram,Avance}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Ajustes, recentes e dados do WebView2 guardados pelo app.
Type: filesandordirs; Name: "{localappdata}\Avance"
