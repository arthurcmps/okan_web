export function formatCnpj(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function formatTelephone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length <= 2) {
    return digits
  }

  const ddd = digits.slice(0, 2)
  const number = digits.slice(2)
  const firstPartLength = digits.length === 11 ? 5 : 4

  const firstPart = number.slice(0, firstPartLength)
  const lastPart = number.slice(firstPartLength)

  return `(${ddd}) ${firstPart}${lastPart ? `-${lastPart}` : ''}`
}

export function formatCep(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, '$1-$2')
}

export function formatUf(value: string): string {
  return value
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 2)
    .toUpperCase()
}