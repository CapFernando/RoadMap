# -*- coding: utf-8 -*-
"""Toda aprovacao do PM/PO vira uma nota no Obsidian.

POR QUE PUXA, E NAO RECEBE. O Worker roda na Cloudflare e o Obsidian escuta em
127.0.0.1 — a Cloudflare nao alcanca o localhost de ninguem. Fazer o contrario
exigiria expor a porta 27123 a internet por um tunel, o que e publicar o vault
inteiro para consertar um problema de direcao. Entao quem puxa e esta maquina.

POR QUE ESCREVE NO DISCO, E NAO PELA REST API. O plugin so responde com o Obsidian
ABERTO. Escrevendo o .md direto na pasta do vault, a nota nasce com o Obsidian
fechado e ele indexa na proxima abertura — e nenhuma chave de API precisa existir
neste arquivo, no agendador ou em qualquer log.

O QUE ELE NUNCA FAZ: apagar nota, sobrescrever o que voce escreveu, ou criar duas
notas para a mesma demanda. O texto que voce acrescentar abaixo do marcador de fim
sobrevive a toda reexecucao — e essa e a parte que faz a nota valer, porque o que
vem do sistema o sistema ja sabe.

Uso:
    python roadmap_para_obsidian.py --simular    # mostra o que faria, sem escrever
    python roadmap_para_obsidian.py              # escreve
    python roadmap_para_obsidian.py --tudo       # reprocessa mesmo o que ja saiu
"""
import argparse
import base64
import io
import json
import os
import re
import subprocess
import sys
import unicodedata
from datetime import datetime, timedelta, timezone

# ── Onde as coisas ficam ─────────────────────────────────────────────────────
VAULT = os.environ.get('OBSIDIAN_VAULT') or r'C:\Users\AUDAX-FERNANDON\Documents\Obsidian Vault'
# A PASTA E DESCOBERTA, e nao fixa. Voce renomeou "Entregas" para
# "Entregas - RoadMap" e o script, apontando para o nome velho, recriaria a pasta
# antiga e escreveria as 114 notas de novo — duas copias de tudo, e a metade que
# voce lesse seria a errada. Agora ele procura a pasta que TEM as notas (pelo
# marcador que so ele escreve) antes de cair no nome padrao.
def _achaPasta(base):
    raiz = os.path.join(base, 'Audax Capital', 'Registros TI')
    padrao = os.path.join(raiz, 'Entregas - RoadMap')
    if not os.path.isdir(raiz):
        return padrao
    candidatas = []
    for nome in os.listdir(raiz):
        d = os.path.join(raiz, nome)
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d)[:40]:
            if not f.endswith('.md'):
                continue
            try:
                if 'roadmap:fim' in io.open(os.path.join(d, f), encoding='utf-8').read(4000):
                    candidatas.append((len([x for x in os.listdir(d) if x.endswith('.md')]), d))
                    break
            except OSError:
                pass
    # A que tem mais notas nossas vence: uma pasta velha esvaziada nao rouba o lugar.
    return max(candidatas)[1] if candidatas else padrao


PASTA = _achaPasta(VAULT)
ESTADO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.estado-obsidian.json')
REPO = 'CapFernando/RoadMap-dados'
ARQ = 'data/melhorias.json'

# Sao Paulo nao tem horario de verao desde 2019.
BR = timezone(timedelta(hours=-3))
# Tudo que o roteiro escreve fica ACIMA desta linha. O que estiver abaixo e seu.
FIM = '<!-- roadmap:fim — o que você escrever abaixo desta linha nunca é sobrescrito -->'


LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ultima-execucao.log')
_linhas = []


def diz(txt=''):
    """Escreve na tela E no log.

    O log existe porque a tarefa agendada roda sem janela: sem ele, o dia em que
    o `gh` perder a credencial ou o vault mudar de lugar, a sincronizacao para em
    silencio e ninguem descobre — a nota simplesmente deixa de aparecer, e isso se
    confunde com "nao aprovei nada essa semana".
    """
    _linhas.append(str(txt))
    try:
        print(txt)
    except (OSError, ValueError):
        pass    # sem console (pythonw): o log basta


def gravaLog():
    """Guarda esta execucao e as anteriores, ate um teto.

    Sem teto, um arquivo que cresce a cada 30 minutos por anos. Com teto de 400
    linhas sobram cerca de duas semanas de historico, que e o que se olha quando
    se pergunta "desde quando parou".
    """
    marca = datetime.now(BR).strftime('%d/%m/%Y %H:%M')
    novo = ['[%s]' % marca] + ['  ' + l if l else '' for l in _linhas] + ['']
    velho = []
    if os.path.exists(LOG):
        try:
            velho = io.open(LOG, encoding='utf-8').read().splitlines()
        except OSError:
            velho = []
    tudo = (novo + velho)[:400]
    try:
        io.open(LOG, 'w', encoding='utf-8', newline='\n').write('\n'.join(tudo) + '\n')
    except OSError:
        pass


def sh(args):
    r = subprocess.run(args, capture_output=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        raise SystemExit('  ERRO %s: %s' % (args[0], (r.stderr or '')[:400]))
    return r.stdout


def base():
    """A base de demandas, pela API autenticada.

    `raw.githubusercontent.com` serve com cache de 5 minutos e ignora cache-buster
    na query — a mesma armadilha que fazia o painel mostrar estado velho. A
    Contents API nao passa por esse cache.
    """
    meta = json.loads(sh(['gh', 'api', 'repos/%s/contents/%s' % (REPO, ARQ)]))
    return json.loads(base64.b64decode(meta['content']).decode('utf-8'))


def dia(v):
    return str(v or '')[:10]


def brasil(v):
    """dd/mm/aaaa a partir de um dia ISO."""
    p = dia(v).split('-')
    return '%s/%s/%s' % (p[2], p[1], p[0]) if len(p) == 3 and all(p) else '—'


def diaLocal(iso):
    """O dia em Sao Paulo de um instante UTC.

    `entregue_em` e gravado com `toISOString()`, em UTC. Uma entrega de sexta as
    21h vira sabado em UTC, e a nota nasceria com a data errada — e datada errado
    ela cai na semana errada de qualquer consulta futura.
    """
    t = str(iso or '').strip()
    if not t:
        return ''
    if 'T' not in t:
        return t[:10]
    try:
        d = datetime.fromisoformat(t.replace('Z', '+00:00'))
        return d.astimezone(BR).strftime('%Y-%m-%d')
    except ValueError:
        return t[:10]


def raiz(nome):
    """A raiz do sistema: os dois primeiros segmentos.

    A mesma regra dos Relatorios e do deck. "AXCred" sozinho juntaria Cadastro,
    Cobranca, Operacoes e Antifraude num balde de 90%.
    """
    p = [x.strip() for x in str(nome or '').split(' - ') if x.strip()]
    return ' - '.join(p[:2]) if p else 'Sem sistema'


def devs(m):
    return [x.strip() for x in re.split(r'[/;,]', str(m.get('dev') or '')) if x.strip()]


def limpaNome(s, teto=110):
    r"""Um nome de arquivo que o Windows aceita e voce reconhece.

    O Windows recusa \ / : * ? " < > | e nao aceita nome terminado em ponto ou
    espaco. Acento e travessao passam — o vault ja usa os dois.
    """
    s = re.sub(r'[\\/:*?"<>|]', ' ', str(s or ''))
    s = re.sub(r'\s+', ' ', s).strip(' .')
    if len(s) > teto:
        s = s[:teto - 1].rstrip() + '…'
    return s.strip(' .') or 'sem titulo'


def tetoDoTitulo():
    """Quanto do titulo cabe, medido a partir de ONDE A PASTA ESTA.

    O Windows corta em 260 caracteres o caminho inteiro, e o erro que ele devolve
    nao diz isso — a nota simplesmente nao e escrita. Com a pasta de hoje (85
    caracteres) o maior nome gerado dava 218: cabia, com 42 de folga. Folga de 42
    some ao renomear uma pasta, ao aninhar mais um nivel, ou ao sincronizar com um
    servico que prefixa o caminho.

    Medindo a partir da pasta, o teto se ajusta sozinho se o vault mudar de lugar,
    e sobra margem de verdade. O que se perde e o fim de um titulo longo — e o
    codigo AX-### esta no nome, que e por onde se procura.
    """
    # data(10) + " - [Entrega] "(13) + "AX-9999"(7) + " "(1) + ".md"(3) = 34
    fixo = 34
    folga = 40          # para o Obsidian criar ".sync-conflict", ".tmp" e afins
    cabe = 260 - len(PASTA) - 1 - fixo - folga
    return max(30, min(110, cabe))


def slug(s):
    """Uma tag sem acento e sem espaco, para o Obsidian agrupar."""
    s = unicodedata.normalize('NFKD', str(s or ''))
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s or 'sem-sistema'


def yaml(v):
    """Escapa um valor de frontmatter. Dois-pontos no titulo quebrava o YAML e o
    Obsidian passava a ler a nota inteira sem metadado nenhum, em silencio."""
    t = str(v if v is not None else '')
    return '"' + t.replace('\\', '\\\\').replace('"', '\\"') + '"'


def nota(m, temas):
    """A nota de uma entrega aprovada."""
    cod = m.get('codigo') or '—'
    titulo = str(m.get('titulo') or '(sem título)').strip()
    tema = temas.get(m.get('tema_id')) or ''
    sistema = raiz(tema) if tema else 'Sem sistema'
    quem = devs(m)
    saiu = diaLocal(m.get('entregue_em')) or dia(m.get('concluido_em'))
    prazo = dia(m.get('entrega'))
    aprov = diaLocal(m.get('validado_em'))
    pts = m.get('poker_pontos')
    plan = m.get('pontos_planejados')
    horas = m.get('horas_realizadas')

    # CUMPRIU O PRAZO? Sem prazo cadastrado nao ha combinado para comparar, e dizer
    # isso e melhor que deixar a nota sem marca — sem marca se confunde com cumpriu.
    if not prazo:
        veredito, atraso = 'sem prazo cadastrado', None
    elif saiu and saiu <= prazo:
        veredito, atraso = 'no prazo', 0
    elif saiu:
        a = datetime.strptime(saiu, '%Y-%m-%d') - datetime.strptime(prazo, '%Y-%m-%d')
        atraso = a.days
        veredito = '%d dia%s após o prazo' % (atraso, '' if atraso == 1 else 's')
    else:
        veredito, atraso = 'sem data de entrega', None

    fm = [
        '---',
        'tipo: Entrega',
        'area: Produto & Tecnologia',
        'data: %s' % (aprov or saiu or prazo),
        'status: Aprovada',
        'codigo: %s' % cod,
        'titulo: %s' % yaml(titulo),
        'dev: [%s]' % ', '.join(yaml(x) for x in quem) if quem else 'dev: []',
        'sistema: %s' % yaml(sistema),
        'sistema_completo: %s' % yaml(tema or '—'),
    ]
    if m.get('solicitante'):
        fm.append('solicitante: %s' % yaml(m['solicitante']))
    if pts:
        fm.append('pontos: %s' % pts)
    if plan and str(plan) != str(pts):
        fm.append('pontos_planejados: %s' % plan)
    if horas:
        fm.append('horas: %s' % horas)
    if m.get('tipo'):
        fm.append('classe: %s' % m['tipo'])
    fm += [
        'inicio: %s' % (dia(m.get('inicio')) or 'null'),
        'prazo: %s' % (prazo or 'null'),
        'entregue: %s' % (saiu or 'null'),
        'aprovado: %s' % (aprov or 'null'),
        'no_prazo: %s' % ('true' if atraso == 0 else ('false' if atraso else 'null')),
    ]
    if atraso:
        fm.append('dias_atraso: %d' % atraso)
    tags = ['roadmap', 'entrega', slug(sistema)]
    if m.get('tipo'):
        tags.append(slug(m['tipo']))
    fm.append('tags: [%s]' % ', '.join(tags))
    fm.append('---')

    # A LINHA QUE RESUME. Quem abre a nota daqui a seis meses le so ela.
    linha = '**[[%s]]**' % quem[0] if quem else '**Sem responsável**'
    if len(quem) > 1:
        linha += ' e ' + ' e '.join('[[%s]]' % x for x in quem[1:])
    linha += ' entregou em **%s**' % brasil(saiu) if saiu else ' — sem data de entrega'
    if prazo:
        linha += ' · prazo era %s (**%s**)' % (brasil(prazo), veredito)
    if pts:
        linha += ' · %s pontos' % pts
    if horas:
        linha += ' · %sh' % horas

    corpo = ['# %s · %s' % (cod, titulo), '', linha, '',
             'Sistema: [[%s]]' % sistema, '']

    desc = str(m.get('descricao') or '').strip()
    impl = str(m.get('implementacao') or '').strip()
    if desc:
        corpo += ['## O que foi pedido', '', desc, '']
    if impl:
        corpo += ['## O que foi implementado', '', impl, '']
    else:
        # DIZER QUE FALTA, em vez de omitir a secao: a nota sem essa parte parece
        # completa, e a falta e justamente o que se quer cobrar do dev.
        corpo += ['## O que foi implementado', '',
                  '> [!warning] O dev não descreveu a entrega',
                  '> Esta demanda foi aprovada sem o texto de implementação. '
                  'Sem ele, a nota registra que algo saiu, mas não o que mudou.', '']

    linhas = [
        ('Início', brasil(m.get('inicio')) if m.get('inicio') else '—'),
        ('Prazo combinado', brasil(prazo) if prazo else '—'),
        ('Entregue pelo dev', brasil(saiu) if saiu else '—'),
        ('Aprovado por %s' % (m.get('validado_por') or 'você'), brasil(aprov) if aprov else '—'),
    ]
    corpo += ['## Rastro', '', '| | |', '|---|---|']
    corpo += ['| %s | %s |' % (a, b) for a, b in linhas]
    corpo += ['']

    links = [l for l in [m.get('link_issue'), m.get('link_pr'), m.get('link_milestone')] if l]
    if links:
        corpo += ['## No GitHub', ''] + ['- %s' % l for l in links] + ['']

    corpo += ['', FIM, '', '## Minhas notas', '']
    return '\n'.join(fm) + '\n\n' + '\n'.join(corpo)


def preserva(caminho, novo):
    """Regrava a parte do sistema e devolve intacta a parte que e sua."""
    if not os.path.exists(caminho):
        return novo
    velho = io.open(caminho, encoding='utf-8').read()
    if FIM not in velho:
        # Nota sem marcador: nasceu de outro jeito ou o marcador foi apagado. Nao
        # mexe — melhor uma nota desatualizada que uma nota sobrescrita.
        return None
    seu = velho.split(FIM, 1)[1]
    return novo.split(FIM, 1)[0] + FIM + seu


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--simular', action='store_true', help='mostra o que faria, sem escrever')
    ap.add_argument('--tudo', action='store_true', help='reprocessa tudo, ignorando o estado')
    args = ap.parse_args()

    d = base()
    temas = {t['id']: t['nome'] for t in d.get('temas', [])}
    ms = [m for m in d['melhorias'] if not m.get('oculto') and not m.get('mesclado_em')]
    aprov = [m for m in ms if str(m.get('validado_em') or '').strip() and m.get('codigo')]
    aprov.sort(key=lambda m: str(m['validado_em']))

    estado = {}
    if os.path.exists(ESTADO) and not args.tudo:
        try:
            estado = json.load(io.open(ESTADO, encoding='utf-8')).get('vistas', {})
        except (ValueError, OSError):
            estado = {}

    # REPROCESSA quando a aprovacao MUDOU: demanda devolvida e reaprovada tem
    # `validado_em` novo, e a nota antiga passaria a mentir sobre a data.
    fila = [m for m in aprov if estado.get(m['codigo']) != str(m['validado_em'])]

    diz('  %d aprovações na base · %d já no vault · %d a escrever'
        % (len(aprov), len(aprov) - len(fila), len(fila)))
    if not fila:
        diz('  nada a fazer')
        gravaLog()
        return 0

    TETO = tetoDoTitulo()
    if not args.simular:
        os.makedirs(PASTA, exist_ok=True)

    novos = atualizados = preservados = 0
    for m in fila:
        cod = m['codigo']
        data = diaLocal(m.get('validado_em')) or dia(m.get('concluido_em'))
        alvo = os.path.join(PASTA, '%s - [Entrega] %s %s.md'
                            % (data, cod, limpaNome(m.get('titulo'), TETO)))

        # UMA NOTA POR DEMANDA, mesmo que a data mude. Reaprovada num outro dia, o
        # nome do arquivo mudaria e sobrariam duas notas da mesma entrega.
        antigas = [os.path.join(PASTA, f) for f in (os.listdir(PASTA) if os.path.isdir(PASTA) else [])
                   if f.endswith('.md') and (' %s ' % cod) in f and
                   os.path.join(PASTA, f) != alvo]

        texto = nota(m, temas)
        if antigas and not args.simular:
            # Move a mais antiga para o nome novo, levando junto o que voce escreveu.
            os.replace(antigas[0], alvo)
            for extra in antigas[1:]:
                diz('     ! duas notas para %s — deixei %s como estava' % (cod, os.path.basename(extra)))

        final = preserva(alvo, texto)
        if final is None:
            preservados += 1
            diz('     ~ %s: nota sem marcador de fim, deixei como está' % cod)
        elif args.simular:
            print('     %s %s' % ('atualizaria' if os.path.exists(alvo) else 'criaria',
                                  os.path.basename(alvo)))
        else:
            existia = os.path.exists(alvo)
            io.open(alvo, 'w', encoding='utf-8', newline='\n').write(final)
            if existia:
                atualizados += 1
            else:
                novos += 1
        estado[cod] = str(m['validado_em'])

    if args.simular:
        print('\n  SIMULACAO — nada foi escrito. Exemplo do que sairia:\n')
        print('  ' + '\n  '.join(nota(fila[-1], temas).splitlines()[:34]))
        return 0

    json.dump({'vistas': estado, 'em': datetime.now(BR).isoformat()},
              io.open(ESTADO, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    diz('  %d nota(s) criada(s), %d atualizada(s), %d preservada(s)'
        % (novos, atualizados, preservados))
    diz('  em %s' % PASTA)
    gravaLog()
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as e:
        # A EXCECAO VIRA LINHA DE LOG. Rodando sem janela, um erro nao tratado
        # desaparece: a tarefa marca falha no agendador e mais nada, e o sintoma
        # que se ve e a nota que nunca chega.
        diz('  FALHOU: %s: %s' % (type(e).__name__, e))
        gravaLog()
        raise
