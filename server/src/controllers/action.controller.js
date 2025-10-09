import { getActionsWithFilters } from '../models/action.model.js';

// Get device actions history with pagination and filters
export const getAllActions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, search = '', filter = 'All', orderBy = 'timestamp', orderDir = 'DESC', date } = req.query;
    
    console.log('🔍 Actions Search:', search, '🎯 Filter:', filter, '📅 Date:', date);
    
    const result = await getActionsWithFilters(id, page, limit, search, filter, orderBy, orderDir, date);
    
    console.log(`✅ Actions returned ${result.data.length} rows, total: ${result.total}`);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error in /actions:', error);
    next(error);
  }
};

