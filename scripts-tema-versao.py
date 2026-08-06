# -*- coding: utf-8 -*-
"""Reaponta tema.css / tema.js nas paginas para o hash do conteudo atual.

Rode isto SEMPRE que editar tema.css ou tema.js:

    python scripts-tema-versao.py

Sem o hash novo, o navegador de quem ja abriu o site serve a versao antiga do
cache e a correcao nao chega. Aconteceu exatamente isso com um ?v= fixo escrito
a mao: editei o tema.js e esqueci de trocar o numero, entao o gancho novo nunca
rodou e o gantt nao redesenhava ao trocar de tema. Hash do conteudo nao deixa
esquecer.
"""
import hashlib
import io
import re
import sys

PAGINAS = ['index.html', 'admin.html', 'dev.html', 'gantt.html',
           'poker.html', 'projetos.html', 'importar.html']


def hash_de(caminho):
    return hashlib.md5(io.open(caminho, 'rb').read()).hexdigest()[:10]


def main():
    # anexo-cola.js entra aqui pelo mesmo motivo dos outros dois: e servido do
    # cache do navegador, e uma correcao nele sem hash novo nunca chega a quem
    # ja abriu o site.
    vcss, vjs = hash_de('tema.css'), hash_de('tema.js')
    vanx = hash_de('anexo-cola.js')
    vmod = hash_de('modelo-descricao.js')
    vlnk = hash_de('links-github.js')
    vsen = hash_de('senha.js')
    mudou = []
    for f in PAGINAS:
        s = io.open(f, encoding='utf-8').read()
        n = re.sub(r'href="tema\.css(\?v=[^"]*)?"', 'href="tema.css?v=%s"' % vcss, s)
        n = re.sub(r'src="tema\.js(\?v=[^"]*)?"', 'src="tema.js?v=%s"' % vjs, n)
        n = re.sub(r'src="anexo-cola\.js(\?v=[^"]*)?"',
                   'src="anexo-cola.js?v=%s"' % vanx, n)
        n = re.sub(r'src="modelo-descricao\.js(\?v=[^"]*)?"',
                   'src="modelo-descricao.js?v=%s"' % vmod, n)
        n = re.sub(r'src="links-github\.js(\?v=[^"]*)?"',
                   'src="links-github.js?v=%s"' % vlnk, n)
        n = re.sub(r'src="senha\.js(\?v=[^"]*)?"',
                   'src="senha.js?v=%s"' % vsen, n)
        if n != s:
            io.open(f, 'w', encoding='utf-8', newline='').write(n)
            mudou.append(f)
    sys.stdout.write('tema.css=%s  tema.js=%s  anexo-cola=%s  modelo=%s  links-gh=%s  senha=%s\n'
                     % (vcss, vjs, vanx, vmod, vlnk, vsen))
    sys.stdout.write('paginas atualizadas: %s\n'
                     % (', '.join(mudou) if mudou else 'nenhuma (ja estavam certas)'))


if __name__ == '__main__':
    main()
