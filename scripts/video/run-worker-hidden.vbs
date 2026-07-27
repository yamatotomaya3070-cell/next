' Launches the video worker WITHOUT showing a console window.
' Called by the KizunaVideoWorker scheduled task via wscript.exe.
' Runs run-worker.bat with window style 0 (Hidden) and returns immediately.
' This stops the terminal window from appearing on every 15-minute run.
' NOTE: keep this file ASCII-only. wscript reads .vbs as the system ANSI
' codepage, so non-ASCII (Japanese) bytes here would break parsing.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run """" & scriptDir & "\run-worker.bat""", 0, False
