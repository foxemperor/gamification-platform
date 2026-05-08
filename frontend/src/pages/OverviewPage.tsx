// Страница «Обзор» — заглушка, будет наполнена в PR feat(frontend): overview page
export function OverviewPage() {
  return (
    <div style={{ padding: '40px 32px', color: 'var(--text)', fontFamily: 'var(--font-b)' }}>
      <h1 style={{ color: 'var(--primary)', fontFamily: 'var(--font-d)', marginBottom: 8 }}>
        Обзор 👋
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
        Страница в разработке — скоро здесь появятся XP, квесты и рейтинг команды.
      </p>
    </div>
  )
}
