export const formatDate = (date: any): string => {
  if (!date) return 'Unknown'
  
  try {
    let dateObj: Date
    
    if (date.toDate && typeof date.toDate === 'function') {
      dateObj = date.toDate()
    } else if (date instanceof Date) {
      dateObj = date
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date)
    } else {
      return 'Unknown'
    }
    
    if (isNaN(dateObj.getTime())) {
      return 'Unknown'
    }
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return 'Unknown'
  }
}