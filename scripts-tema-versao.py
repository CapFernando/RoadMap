# -*- coding: utf-8 -*-
"""Reaponta os arquivos selados das paginas para o hash do conteudo atual.

Rode isto SEMPRE que editar um .js ou .css compartilhado:

    python scripts-tema-versao.py

Sem o hash novo, o navegador de quem ja abriu o site serve a versao antiga do
cache e a correcao nao chega. Aconteceu exatamente isso com um ?v= fixo escrito
a mao: editei o tema.js e esqueci de trocar o numero, entao o gancho novo nunca
rodou e o gantt nao redesenhava ao trocar de tema. Hash do conteudo nao deixa
esquecer.

O QUE ELE SELA NAO ESTA ESCRITO AQUI. Havia uma linha por arquivo — um
`hash_de()` e um `re.sub()` para cada um —, e o defeito foi o previsivel: dos
arquivos selados da base, `capacidade.js` e `prazo.js` nunca entraram na lista.
Um ficou certo porque eu atualizei o selo a mao; o outro ficou por sorte. Uma
lista escrita a mao de tudo que precisa de selo tem o mesmo defeito do selo
escrito a mao: da para esquecer. As paginas ja dizem quem carregam, entao a
resposta e ler as paginas.
"""
import hashlib
import io
import os
import re
import sys

PAGINAS = ['index.html', 'admin.html', 'dev.html', 'gantt.html',
           'poker.html', 'projetos.html', 'importar.html', 'mensageria.html']

# `src="algo.js?v=..."` ou `href="algo.css?v=..."`, so arquivo local.
REF = re.compile(r'(?:src|href)="([A-Za-z0-9_.-]+\.(?:js|css))\?v=[^"]*"')


def hash_de(caminho):
    # `with` de proposito: sem fechar, o handle fica pendurado e no Windows a
    # gravacao do MESMO arquivo logo depois morre com "[Errno 22] Invalid
    # argument". Aconteceu — o script abortou no meio, deixando parte das
    # paginas com hash novo e parte com o antigo.
    with io.open(caminho, 'rb') as fh:
        return hashlib.md5(fh.read()).hexdigest()[:10]


def alvos():
    """Os arquivos que as paginas selam, descobertos NELAS."""
    achados = set()
    for f in PAGINAS:
        with io.open(f, encoding='utf-8') as fh:
            achados.update(REF.findall(fh.read()))
    # Selo apontando para arquivo que nao existe e 404 em producao: a pagina
    # carrega sem o modulo e a tela quebra sem dizer por que. Melhor parar aqui.
    faltando = sorted(a for a in achados if not os.path.exists(a))
    if faltando:
        raise SystemExit('selo aponta para arquivo inexistente: ' + ', '.join(faltando))
    return sorted(achados)


def main():
    selos = {a: hash_de(a) for a in alvos()}
    mudou = []
    for f in PAGINAS:
        with io.open(f, encoding='utf-8') as fh:
            original = fh.read()
        novo = original
        for arq, v in selos.items():
            attr = 'href' if arq.endswith('.css') else 'src'
            novo = re.sub(
                r'%s="%s(\?v=[^"]*)?"' % (attr, re.escape(arq)),
                '%s="%s?v=%s"' % (attr, arq, v),
                novo)
        if novo != original:
            with io.open(f, 'w', encoding='utf-8', newline='') as fh:
                fh.write(novo)
            mudou.append(f)

    for arq in sorted(selos):
        sys.stdout.write('  %-26s %s\n' % (arq, selos[arq]))
    sys.stdout.write('paginas atualizadas: %s\n'
                     % (', '.join(mudou) if mudou else 'nenhuma (ja estavam certas)'))


if __name__ == '__main__':
    main()
