name: Enviar avisos do Bolao
on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:
    inputs:
      teste:
        description: 'Opcional: p1, p2, p3, p4... (ou admin) para mandar uma notificacao de teste. Vazio = rotina normal.'
        default: ''
permissions:
  actions: write
concurrency:
  group: avisos
  cancel-in-progress: false
jobs:
  enviar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install --no-save firebase-admin
      - name: Enviar
        env:
          SA: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          TESTE: ${{ inputs.teste }}
        run: |
          printf '%s' "$SA" > "$RUNNER_TEMP/sa.json"
          if [ -n "$TESTE" ]; then GOOGLE_APPLICATION_CREDENTIALS="$RUNNER_TEMP/sa.json" node avisos/enviar.js teste "$TESTE"
          else GOOGLE_APPLICATION_CREDENTIALS="$RUNNER_TEMP/sa.json" node avisos/enviar.js; fi
          rm -f "$RUNNER_TEMP/sa.json"
      - name: Manter o agendamento ativo (o GitHub desliga agendamentos de repositorios parados ha 60 dias)
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh api -X PUT repos/${{ github.repository }}/actions/workflows/avisos.yml/enable || true
