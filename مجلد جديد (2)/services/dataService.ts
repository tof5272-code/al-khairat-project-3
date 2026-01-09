import { Employee, SalaryRecord, GenericRecord } from '../types';

// URLs provided in the files
const URLS = {
  ADMIN: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTji7xqDlsIEqmdqSFJnunFov95noGe4OcaSVoBkzTl1uPWTevB2lRU1oMmDCD4hvkjzOgf5d6Vve7x/pub?output=csv',
  CURRENT_SALARY: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTsXbqGO6bjMlqDv9mIj79NqaN48VrYAxJcfapTqnYbyTyBPXkhz22YsKKH2fDeQfDuHfkZl2BmCrG/pub?gid=666661995&single=true&output=csv',
  ARCHIVE_SALARY: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTsXbqGO6bjMlqDv9mIj79NqaN48VrYAxJcfapTqnYbyTyBPXkhz22YsKKH2fDeQfDuHfkZl2BmCrG/pub?gid=1417662678&single=true&output=csv',
  BONUS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTsXbqGO6bjMlqDv9mIj79NqaN48VrYAxJcfapTqnYbyTyBPXkhz22YsKKH2fDeQfDuHfkZl2BmCrG/pub?gid=1629531206&single=true&output=csv',
  DISPATCHES: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTsXbqGO6bjMlqDv9mIj79NqaN48VrYAxJcfapTqnYbyTyBPXkhz22YsKKH2fDeQfDuHfkZl2BmCrG/pub?gid=1862138881&single=true&output=csv',
  EXTRA_HOURS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRTsXbqGO6bjMlqDv9mIj79NqaN48VrYAxJcfapTqnYbyTyBPXkhz22YsKKH2fDeQfDuHfkZl2BmCrG/pub?gid=604832310&single=true&output=csv'
};

// CSV Parser Helper
const parseCSV = (text: string) => {
  return text.split('\n').map(row => 
    row.split(',').map(cell => cell.trim().replace(/"/g, ''))
  );
};

const findAmountIndex = (headerRow: string[]) => {
  const possibleNames = ['مبلغ', 'قيمة', 'إجمالي', 'مكافأة', 'إيفاد', 'ساعات إضافية', 'القيمة', 'الإضافي'];
  for (const name of possibleNames) {
    const index = headerRow.findIndex(h => h.includes(name));
    if (index !== -1) return index;
  }
  return -1;
};

// Fetch and Parse Functions
export const fetchEmployeeData = async (employeeId: string): Promise<Employee> => {
  const uniqueParam = `&_t=${Date.now()}`;
  const requestOptions: RequestInit = {
    method: 'GET',
    cache: 'no-store'
  };

  const responses = await Promise.all([
    fetch(URLS.ADMIN + uniqueParam, requestOptions),
    fetch(URLS.CURRENT_SALARY + uniqueParam, requestOptions),
    fetch(URLS.ARCHIVE_SALARY + uniqueParam, requestOptions),
    fetch(URLS.BONUS + uniqueParam, requestOptions),
    fetch(URLS.DISPATCHES + uniqueParam, requestOptions),
    fetch(URLS.EXTRA_HOURS + uniqueParam, requestOptions)
  ]);

  for (const res of responses) {
    if (!res.ok) throw new Error(`فشل الاتصال بالخادم: ${res.status}`);
  }

  const texts = await Promise.all(responses.map(res => res.text()));
  
  const [adminCsv, currentSalaryCsv, archiveSalaryCsv, bonusCsv, dispatchesCsv, extraHoursCsv] = texts;

  // 1. Parse Admin Data
  const adminRows = parseCSV(adminCsv);
  const adminData = adminRows.find(row => row[0] === employeeId);

  if (!adminData && !employeeId) {
    throw new Error('الرقم الوظيفي غير موجود');
  }

  if (!adminData) {
     throw new Error('لم يتم العثور على البيانات الإدارية لهذا الموظف');
  }

  const administrativeProfile = {
    p_id: adminData[0] || '',
    p_name: adminData[1] || '',
    p_education: adminData[2] || '',
    p_job: adminData[3] || '', 
    p_grade: adminData[4] || '',
    p_stage: adminData[5] || '',
    p_salary: adminData[6] || '',
    p_promo_date: adminData[7] || '',
    p_last_bonus: adminData[8] || '',
    p_due_pre: adminData[9] || '',
    p_thanks: adminData[10] || '',
    p_due_post: adminData[11] || '',
    p_join_date: adminData[12] || '',
    p_promo_status: adminData[13] || '',
    p_rollover: adminData[14] || '',
    // Update indices: Col P(15) is Service Duration (skipped), Col Q(16) is Annual Leave, Col R(17) is Sick Leave
    p_annual_leave: adminData[16] || '0', 
    p_sick_leave: adminData[17] || '0',   
    p_img: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(adminData[1] || 'User') + '&background=random',
    p_job_title: adminData[3] || ''
  };

  // 2. Parse Salary Data
  const parseSalarySheet = (csv: string) => {
    const rows = parseCSV(csv);
    if (rows.length < 2) return [];
    
    const header = rows[0];
    const idIndex = header.findIndex(h => h.includes('الرقم الوظيفي'));
    const netSalaryIndex = header.findIndex(h => h.includes('صافي الراتب'));
    const dateIndex = header.findIndex(h => h.includes('التاريخ'));
    
    if (idIndex === -1) return [];

    return rows.slice(1)
      .filter(row => row[idIndex] === employeeId)
      .map(row => {
        const details: { label: string; value: string }[] = [];
        header.forEach((h, idx) => {
          if (idx !== idIndex && idx !== dateIndex && row[idx] && row[idx] !== '0' && h.trim() !== '') {
            details.push({ label: h, value: row[idx] });
          }
        });

        const dateStr = dateIndex !== -1 ? row[dateIndex] : '';
        let month = 'الحالي';
        let year = new Date().getFullYear().toString();
        
        if (dateStr) {
            const match = dateStr.match(/(\d{4})[/-](\d{1,2})/);
            if (match) {
                year = match[1];
                const mIndex = parseInt(match[2]) - 1;
                month = new Date(parseInt(year), mIndex).toLocaleString('ar-IQ', { month: 'long' });
            }
        }

        return {
          month,
          year,
          net_salary: netSalaryIndex !== -1 ? row[netSalaryIndex] : '0',
          details,
          raw_date: dateStr
        };
      });
  };

  const currentSalaries = parseSalarySheet(currentSalaryCsv);
  const archiveSalaries = parseSalarySheet(archiveSalaryCsv);
  
  const salary_history = [...currentSalaries, ...archiveSalaries].sort((a, b) => {
     if (a.raw_date && b.raw_date) return a.raw_date > b.raw_date ? -1 : 1;
     return 0;
  });

  // 3. Parse Sub-sheets (Bonus, Dispatch, Extra) with improved Date detection
  const parseGenericSheet = (csv: string): GenericRecord[] => {
    const rows = parseCSV(csv);
    if (rows.length < 2) return [];
    
    const header = rows[0];
    const idIndex = header.findIndex(h => h.includes('الرقم الوظيفي'));
    const amountIndex = findAmountIndex(header);
    
    // Improved logic for Date and Name columns
    const nameIndex = header.findIndex(h => 
      h.includes('اسم') || h.includes('عنوان') || h.includes('السبب') || h.includes('نوع') || h.includes('البيان')
    ); 
    
    const dateIndex = header.findIndex(h => 
      h.includes('تاريخ') || h.includes('Date') || h.includes('date') || h.includes('وقت') || h.includes('شهر')
    );

    if (idIndex === -1) return [];

    return rows.slice(1)
      .filter(row => row[idIndex] === employeeId)
      .map(row => {
        const amountStr = amountIndex !== -1 ? row[amountIndex] : '0';
        const amount = parseFloat(amountStr.replace(/[^\d.-]/g, '')) || 0;
        
        const name = nameIndex !== -1 ? row[nameIndex] : (header[amountIndex] || 'Record');
        
        // Extract raw date
        let dateStr = dateIndex !== -1 ? row[dateIndex] : undefined;
        
        // Clean date if it exists
        if (dateStr) {
            dateStr = dateStr.split(' ')[0]; // Remove time if present
        }

        return { name, amount, date: dateStr };
      })
      .filter(r => r.amount > 0); // Keep all positive records, removed arbitrary date filtering for now
  };

  return {
    ...administrativeProfile,
    salary_history,
    bonuses: parseGenericSheet(bonusCsv),
    dispatches: parseGenericSheet(dispatchesCsv),
    extra_hours: parseGenericSheet(extraHoursCsv),
  };
};