Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\Sicky Notes"
WshShell.Run "cmd /c npm run app", 0, False
