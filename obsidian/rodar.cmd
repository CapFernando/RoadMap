@echo off
REM Roda o sincronizador e guarda a ultima saida.
REM
REM Existe como .cmd, e nao como chamada direta ao python na tarefa agendada,
REM por dois motivos: o diretorio de trabalho fica garantido (o script grava o
REM `.estado-obsidian.json` ao lado de si mesmo), e a saida vai para um log que
REM se pode ler depois — tarefa agendada que falha em silencio e tarefa que
REM ninguem descobre que parou.
cd /d "%~dp0"
"C:\Python314\python.exe" -X utf8 "%~dp0roadmap_para_obsidian.py" %* > "%~dp0ultima-execucao.log" 2>&1
exit /b %ERRORLEVEL%
